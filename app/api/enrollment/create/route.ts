import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe-server'
import { sendEnrollmentConfirmation, sendVoucherEmail, sendAdminAlert, escapeHtml } from '@/lib/email'
import { isSessionFullError } from '@/lib/capacity'

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Record a paid-but-full case in capacity_overflows and send the admin alert.
// Upserts on stripe_payment_intent_id so webhook + success-page cannot both
// create duplicate rows for the same charge.
async function recordCapacityOverflow(args: {
  sessionId: string
  guestEmail: string
  guestName: string
  phone: string | null
  amountPaid: number
  paymentIntentId: string
  className: string
  sessionDate: string
  sessionStart: string
  source: 'checkout' | 'webhook'
}) {
  const { error: upsertError } = await supabaseAdmin
    .from('capacity_overflows')
    .upsert(
      {
        session_id: args.sessionId,
        guest_email: args.guestEmail,
        guest_name: args.guestName,
        amount_paid: args.amountPaid,
        stripe_payment_intent_id: args.paymentIntentId,
        payload: {
          phone: args.phone,
          className: args.className,
          sessionDate: args.sessionDate,
          sessionStart: args.sessionStart,
          source: args.source,
        },
        resolved: false,
      },
      { onConflict: 'stripe_payment_intent_id' }
    )

  if (upsertError) {
    console.error('[CAPACITY_OVERFLOW] Upsert failed — the charge still exists in Stripe, admin alert is the backstop:', {
      upsertError,
      paymentIntentId: args.paymentIntentId,
      sessionId: args.sessionId,
    })
  }

  // Admin email is independent of the DB write — never let one failure
  // swallow the other, both are backstops for a paid-but-unseated student.
  await sendAdminAlert(
    'SaveYours — Paid but class full (manual move or refund required)',
    `<h2>Paid but class full</h2>
    <p>A student was charged but their class is full. <strong>Do not auto-refund</strong> — contact them within 24 hours to move them to another date or issue a refund from the Stripe dashboard.</p>
    <table style="border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;">Student:</td><td style="padding:8px;">${escapeHtml(args.guestName)} (${escapeHtml(args.guestEmail)})</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Phone:</td><td style="padding:8px;">${escapeHtml(args.phone || 'N/A')}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Class:</td><td style="padding:8px;">${escapeHtml(args.className)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Session date/time:</td><td style="padding:8px;">${escapeHtml(args.sessionDate)} at ${escapeHtml(args.sessionStart)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Amount paid:</td><td style="padding:8px;">$${args.amountPaid.toFixed(2)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Payment Intent:</td><td style="padding:8px;">${escapeHtml(args.paymentIntentId)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Source:</td><td style="padding:8px;">${escapeHtml(args.source)}</td></tr>
    </table>
    <p>See the <a href="https://saveyours.net/admin">Admin Dashboard</a> overflow banner to mark this resolved once the student is handled.</p>`
  ).catch(err => console.error('[CAPACITY_OVERFLOW] Admin alert email failed:', err))
}

// Called from the checkout success flow (app/cart/page.tsx) immediately after
// stripe.confirmPayment() resolves. This is the PRIMARY path for creating
// enrollments and sending confirmation/voucher emails — the Stripe webhook
// acts as a fallback (see app/api/webhook/stripe/route.ts).
//
// payment_status is set from the live Stripe PaymentIntent status rather than
// waiting on the webhook. If the status lookup fails, the enrollment stays
// 'pending' and the webhook picks it up.
export async function POST(req: NextRequest) {
  try {
    const {
      sessionIds,
      sessionId,
      email: rawEmail,
      name,
      phone,
      paymentIntentId,
    } = await req.json()

    // Normalize the email to lowercase before storing. The student session
    // (lib/student-auth.ts) verifies with lowercase emails, and .eq()
    // matches on the /api/student/enrollments query only find rows stored
    // that way. Historical rows were lowercased by a one-time migration.
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail

    // Accept either a single sessionId (legacy) or an array of sessionIds
    const ids: string[] = Array.isArray(sessionIds) && sessionIds.length > 0
      ? sessionIds
      : (sessionId ? [sessionId] : [])

    if (ids.length === 0 || !email || !name || !paymentIntentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the payment actually succeeded in Stripe before touching the DB.
    // This prevents anyone from POSTing arbitrary paymentIntentIds to create
    // fake enrollments.
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not confirmed' }, { status: 400 })
    }

    // Idempotency per payment intent. If ANY enrollment already exists for
    // this PI (either from the webhook winning the race, or from a prior
    // retry of this same request), return the existing rows rather than
    // re-running the RPC. Capacity_overflows uses the same key so the two
    // tables stay in sync.
    const { data: existingByPi, error: existingByPiError } = await supabaseAdmin
      .from('enrollments')
      .select('id, session_id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
    if (existingByPiError) {
      console.error('[ENROLLMENT] Lookup-by-PI failed:', existingByPiError)
    }
    const existingSessionIds = new Set((existingByPi ?? []).map(e => e.session_id))

    const enrolledClasses: { className: string; date: string; time: string; enrollmentId: string }[] = []
    let overflowCount = 0

    for (const sid of ids) {
      // If a prior run (or the webhook) already created the enrollment for
      // this PI + session combo, skip to avoid duplicate emails or RPC calls.
      if (existingSessionIds.has(sid)) {
        console.log(
          `[ENROLLMENT] Enrollment already exists for ${paymentIntent.id}/${sid} — skipping`
        )
        continue
      }

      const { data: session } = await supabaseAdmin
        .from('class_sessions')
        .select('*, class:classes(*)')
        .eq('id', sid)
        .single()
      if (!session) {
        console.error(`[ENROLLMENT] Session not found: ${sid}`)
        continue
      }

      // Use the atomic RPC for the capacity check + insert so we can't overbook
      // even under concurrent checkouts. The RPC can either return
      // { success:false, error:'CLASS_FULL' } or — now that the DB trigger is
      // in place — raise a Postgres exception whose message starts with
      // SESSION_FULL. Treat both as the same case.
      const { data: result, error: rpcError } = await supabaseAdmin.rpc('enroll_student_if_capacity', {
        p_session_id: sid,
        p_guest_name: name,
        p_guest_email: email,
        p_phone: phone || '',
        p_stripe_payment_intent_id: paymentIntent.id,
        p_amount_paid: session.class.price,
      }) as { data: { success: boolean; error?: string; enrollment_id?: string } | null; error: unknown }

      const isFullFromRpc = result && !result.success && result.error === 'CLASS_FULL'
      const isFullFromTrigger = !!rpcError && isSessionFullError(rpcError)

      if (isFullFromRpc || isFullFromTrigger) {
        console.warn('[ENROLLMENT] Session full — recording overflow:', {
          sid,
          email,
          paymentIntentId: paymentIntent.id,
          source: isFullFromTrigger ? 'trigger' : 'rpc',
        })
        await recordCapacityOverflow({
          sessionId: sid,
          guestEmail: email,
          guestName: name,
          phone: typeof phone === 'string' ? phone : null,
          amountPaid: Number(session.class.price) || paymentIntent.amount / 100,
          paymentIntentId: paymentIntent.id,
          className: session.class.name,
          sessionDate: session.date,
          sessionStart: session.start_time,
          source: 'checkout',
        })
        overflowCount++
        continue
      }

      if (rpcError) {
        console.error('[ENROLLMENT] RPC error for session:', { rpcError, sid, email })
        continue
      }

      if (!result || !result.success) {
        // Non-capacity failure (e.g. session cancelled, archived). Leave to
        // the webhook which runs the same RPC — it may succeed, or it may
        // also fail and record an overflow.
        console.warn('[ENROLLMENT] Enrollment did not succeed; leaving to webhook:', {
          result,
          sid,
          email,
        })
        continue
      }

      // Read the live PaymentIntent status and set payment_status from it,
      // rather than depending on the webhook. Isolated in try/catch: a Stripe
      // lookup failure must not kill enrollment creation or email sending
      // (April 2026 incident).
      if (result.enrollment_id) {
        let paymentStatus: 'pending' | 'paid' = 'pending'
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntent.id)
          if (pi.status === 'succeeded') {
            paymentStatus = 'paid'
          }
        } catch (statusLookupError) {
          console.error('[PAYMENT_STATUS] Failed to retrieve PaymentIntent; leaving enrollment as pending:', {
            paymentIntentId: paymentIntent.id,
            enrollmentId: result.enrollment_id,
            error: statusLookupError,
          })
        }

        const { error: statusError } = await supabaseAdmin
          .from('enrollments')
          .update({ payment_status: paymentStatus })
          .eq('id', result.enrollment_id)
        if (statusError) {
          console.error('[PAYMENT_STATUS] Failed to update payment_status:', statusError)
        }
      }

      enrolledClasses.push({
        className: session.class.name,
        date: session.date,
        time: `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`,
        enrollmentId: result.enrollment_id ?? '',
      })

      // Assign and send the voucher email for this session. Voucher failures
      // are non-fatal — admin can assign manually from the dashboard.
      try {
        const { data: voucher, error: voucherError } = await supabaseAdmin
          .from('voucher_links')
          .select('*')
          .eq('session_id', sid)
          .eq('status', 'available')
          .limit(1)
          .maybeSingle()
        if (voucherError) {
          console.error('[ENROLLMENT] Error fetching available voucher:', voucherError)
        }

        if (voucher) {
          const { error: assignError } = await supabaseAdmin
            .from('voucher_links')
            .update({
              status: 'assigned',
              assigned_to_email: email,
              assigned_at: new Date().toISOString(),
            })
            .eq('id', voucher.id)
          if (!assignError) {
            await sendVoucherEmail(email, {
              name,
              className: session.class.name,
              date: session.date,
              time: `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`,
              voucherUrl: voucher.voucher_url,
            })
            console.log(`[ENROLLMENT] Voucher email sent to ${email} for session ${sid}`)
          } else {
            console.error('[ENROLLMENT] Failed to assign voucher:', assignError)
          }
        } else {
          console.warn(
            `[ENROLLMENT] No available voucher for session ${sid} — manual assignment required for ${email}`
          )
        }
      } catch (voucherError) {
        console.error('[ENROLLMENT] Voucher assignment error (non-fatal):', voucherError)
      }
    }

    // Send ONE confirmation email covering the first enrolled class. Only
    // sent if this request actually created an enrollment — otherwise the
    // webhook path will have already sent it.
    if (enrolledClasses.length > 0) {
      try {
        console.log('[ENROLLMENT] Attempting to send confirmation email', {
          to: email,
          className: enrolledClasses[0].className,
          emailUserSet: !!process.env.EMAIL_USER,
          emailPassSet: !!process.env.EMAIL_PASS,
          emailHostSet: !!process.env.EMAIL_HOST,
        })
        const result = await sendEnrollmentConfirmation(
          email,
          {
            name,
            className: enrolledClasses[0].className,
            date: enrolledClasses[0].date,
            time: enrolledClasses[0].time,
          },
          { enrollmentId: enrolledClasses[0].enrollmentId }
        )
        if (!result?.success) {
          const err = (result as { error?: unknown })?.error as
            | { message?: string; code?: string; command?: string; response?: string; responseCode?: number; stack?: string }
            | undefined
          console.error('[ENROLLMENT] Confirmation email returned failure', {
            to: email,
            errorMessage: err?.message,
            errorCode: err?.code,
            errorCommand: err?.command,
            errorResponse: err?.response,
            errorResponseCode: err?.responseCode,
            errorStack: err?.stack,
            rawError: err,
          })
        } else {
          console.log('[ENROLLMENT] Confirmation email sent successfully to', email)
        }
      } catch (emailError) {
        const err = emailError as { message?: string; code?: string; command?: string; response?: string; responseCode?: number; stack?: string }
        console.error('[ENROLLMENT] Confirmation email threw exception', {
          to: email,
          errorMessage: err?.message,
          errorCode: err?.code,
          errorCommand: err?.command,
          errorResponse: err?.response,
          errorResponseCode: err?.responseCode,
          errorStack: err?.stack,
          rawError: emailError,
        })
      }
    }

    return NextResponse.json({
      success: true,
      enrolledCount: enrolledClasses.length,
      overflowCount,
      message:
        overflowCount > 0
          ? "This class filled up while you were checking out. We've been notified and will contact you within 24 hours to move you to another date or refund you."
          : undefined,
    })
  } catch (error) {
    console.error('Enrollment creation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
