import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEnrollmentConfirmation, sendVoucherEmail, sendAdminAlert, escapeHtml } from '@/lib/email'
import { isSessionFullError } from '@/lib/capacity'
import { completeReschedule } from '@/lib/reschedule-complete'
import Stripe from 'stripe'

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Mirror of recordCapacityOverflow in app/api/enrollment/create. Kept as a
// local copy rather than a shared import so the two call sites stay simple
// to audit — the function body is small, and the two emails differ in the
// "source" they report.
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
    console.error('[CAPACITY_OVERFLOW] Upsert failed — admin alert is the backstop:', {
      upsertError,
      paymentIntentId: args.paymentIntentId,
      sessionId: args.sessionId,
    })
  }

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
    <p>See the <a href="https://saveyours.net/admin">Admin Dashboard</a> overflow banner to mark this resolved.</p>`
  ).catch(err => console.error('[CAPACITY_OVERFLOW] Admin alert email failed:', err))
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Webhook Error: ${errorMessage}`)
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // Reschedule flow is driven by Checkout Sessions, which also fire
  // payment_intent.succeeded on their own PI. We tag that PI with
  // metadata.type='reschedule' so the enrollment path below skips it
  // entirely — otherwise the webhook would try to create an enrollment
  // from the reschedule-fee charge.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const type = session.metadata?.type
    if (type === 'reschedule') {
      const outcome = await completeReschedule(session.id).catch((err) => {
        console.error('[WEBHOOK] completeReschedule threw:', err)
        return null
      })
      console.log('[WEBHOOK] Reschedule completion outcome:', { sessionId: session.id, outcome })
    }
    // Non-reschedule checkout sessions are not something we create today —
    // if we add them later this branch can be extended. Fall through.
    return NextResponse.json({ received: true })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const metadata = paymentIntent.metadata

    // Reschedule fee PIs are handled by checkout.session.completed above.
    // Never run the enrollment-creation logic on them.
    if (metadata?.type === 'reschedule') {
      console.log('[WEBHOOK] Skipping payment_intent.succeeded for reschedule PI:', paymentIntent.id)
      return NextResponse.json({ received: true })
    }

    const name = metadata.name || metadata.customer_name || 'Unknown - check Stripe'
    // Lowercase to match how /api/enrollment/create stores it — keeps
    // /api/student/enrollments' .eq() lookups working under either code path.
    const email = (metadata.email || metadata.receipt_email || paymentIntent.receipt_email || 'unknown@saveyours.net').trim().toLowerCase()
    const phone = metadata.phone || ''

    if (!metadata.name || !metadata.email) {
      console.error('MISSING METADATA for payment:', paymentIntent.id, 'amount:', paymentIntent.amount)
      sendAdminAlert(
        '⚠️ SaveYours - Payment with missing data detected',
        `<h2>Payment with Missing Data</h2>
        <p>A payment succeeded in Stripe but is missing customer metadata.</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;font-weight:bold;">Payment Intent ID:</td><td style="padding:8px;">${escapeHtml(paymentIntent.id)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Amount Paid:</td><td style="padding:8px;">$${(paymentIntent.amount / 100).toFixed(2)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Missing Fields:</td><td style="padding:8px;">${!metadata.name ? 'Name' : ''}${!metadata.name && !metadata.email ? ', ' : ''}${!metadata.email ? 'Email' : ''}</td></tr>
        </table>
        <p>Please check the <strong>Reconcile</strong> tool in the <a href="https://saveyours.net/admin">Admin Dashboard</a> to review and fix this enrollment.</p>`
      ).catch(err => console.error('Failed to send admin alert email:', err))
    }

    // Get all session IDs from metadata
    let sessionIds: string[] = [];

    if (metadata.sessionIds) {
      // New format: array of session IDs stored as JSON
      try {
        sessionIds = JSON.parse(metadata.sessionIds);
      } catch {
        sessionIds = [];
      }
    }

    // Fall back to single sessionId for backwards compatibility
    if (sessionIds.length === 0 && metadata.sessionId) {
      sessionIds = [metadata.sessionId];
    }

    // Idempotency per payment intent across the whole webhook invocation.
    // Pre-fetching all enrollments owned by this PI lets us decide, per
    // session, whether the checkout flow already landed the row — avoiding
    // a second RPC call and the race window that caused the 10/03 overbook.
    const { data: enrollmentsForPi } = await supabaseAdmin
      .from('enrollments')
      .select('id, session_id, payment_status')
      .eq('stripe_payment_intent_id', paymentIntent.id)
    const existingBySession = new Map<string, { id: string; payment_status: string }>()
    for (const row of enrollmentsForPi ?? []) {
      existingBySession.set(row.session_id, { id: row.id, payment_status: row.payment_status })
    }

    // The checkout success flow (app/api/enrollment/create) is now the primary
    // creator of enrollments + sender of emails. This webhook's job is:
    //   1. If an enrollment already exists for a given paymentIntent+session,
    //      just confirm the payment by flipping payment_status to 'paid'.
    //   2. If no enrollment exists (checkout flow failed or never ran), run
    //      the full fallback: create the enrollment, assign voucher, send
    //      voucher email, and send the confirmation email.
    //
    // Tracking which sessions the webhook CREATED (vs. merely confirmed) lets
    // us avoid sending a duplicate confirmation email in the happy path.
    const createdByWebhook: { className: string; date: string; time: string; enrollmentId: string }[] = []

    for (const sessionId of sessionIds) {
      const { data: session } = await supabaseAdmin
        .from('class_sessions')
        .select('*, class:classes(*)')
        .eq('id', sessionId)
        .single();
      if (!session) {
        console.warn('[WEBHOOK] Session not found:', sessionId);
        continue;
      }

      // Happy path: checkout flow already created this enrollment.
      const existing = existingBySession.get(sessionId) ?? null

      if (existing) {
        if (existing.payment_status === 'paid') {
          // Idempotent no-op: the checkout flow already confirmed this one.
          console.log('[WEBHOOK] Enrollment already paid, no-op:', existing.id);
        } else {
          const { error: statusError } = await supabaseAdmin
            .from('enrollments')
            .update({ payment_status: 'paid' })
            .eq('id', existing.id);
          if (statusError) {
            console.error('[WEBHOOK] Failed to flip payment_status to paid:', statusError);
          } else {
            console.log('[WEBHOOK] Enrollment confirmed (payment_status=paid):', existing.id);
          }
        }
        // Checkout flow has already sent emails — do NOT resend here.
        continue;
      }

      // Fallback path: checkout flow did not create this enrollment.
      console.warn('[WEBHOOK] No enrollment found — running fallback:', {
        paymentIntentId: paymentIntent.id,
        sessionId,
        email,
      });

      const { data: result, error: rpcError } = await supabaseAdmin.rpc('enroll_student_if_capacity', {
        p_session_id: sessionId,
        p_guest_name: name,
        p_guest_email: email,
        p_phone: phone,
        p_stripe_payment_intent_id: paymentIntent.id,
        p_amount_paid: session.class.price,
      }) as { data: { success: boolean; error?: string; enrollment_id?: string } | null; error: unknown };

      const isFullFromRpc = result && !result.success && result.error === 'CLASS_FULL'
      const isFullFromTrigger = !!rpcError && isSessionFullError(rpcError)

      if (isFullFromRpc || isFullFromTrigger) {
        console.warn(`[WEBHOOK] Session full — recording overflow for ${sessionId}, ${email}`);
        await recordCapacityOverflow({
          sessionId,
          guestEmail: email,
          guestName: name,
          phone: phone || null,
          amountPaid: Number(session.class.price) || paymentIntent.amount / 100,
          paymentIntentId: paymentIntent.id,
          className: session.class.name,
          sessionDate: session.date,
          sessionStart: session.start_time,
          source: 'webhook',
        })
        continue
      }

      if (rpcError) {
        console.error('❌ [WEBHOOK] RPC error for session:', { rpcError, sessionId, email });
        continue;
      }

      if (result && result.success) {
        console.log('🎟️ [WEBHOOK] Fallback enrollment created:', {
          enrollmentId: result.enrollment_id,
          sessionId,
          email,
        });

        // Webhook is the authoritative confirmation — mark paid immediately.
        if (result.enrollment_id) {
          const { error: statusError } = await supabaseAdmin
            .from('enrollments')
            .update({ payment_status: 'paid' })
            .eq('id', result.enrollment_id);
          if (statusError) {
            console.error('[WEBHOOK] Failed to set payment_status=paid on fallback enrollment:', statusError);
          }
        }

        createdByWebhook.push({
          className: session.class.name,
          date: session.date,
          time: `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`,
          enrollmentId: result.enrollment_id ?? '',
        });

        // Fallback voucher assignment + email.
        console.log('🎟️ [WEBHOOK] Starting voucher assignment (fallback) for session:', sessionId);
        try {
          const { data: voucher, error: voucherError } = await supabaseAdmin
            .from('voucher_links')
            .select('*')
            .eq('session_id', sessionId)
            .eq('status', 'available')
            .limit(1)
            .maybeSingle();

          if (voucherError) {
            console.error('🎟️ [WEBHOOK] Error getting available voucher:', voucherError);
          }

          if (voucher) {
            const { error: assignError } = await supabaseAdmin
              .from('voucher_links')
              .update({
                status: 'assigned',
                assigned_to_email: email,
                assigned_at: new Date().toISOString(),
              })
              .eq('id', voucher.id);

            if (!assignError) {
              const emailResult = await sendVoucherEmail(email, {
                name,
                className: session.class.name,
                date: session.date,
                time: `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`,
                voucherUrl: voucher.voucher_url,
              });
              console.log('🎟️ [WEBHOOK] Voucher email result:', emailResult);
            } else {
              console.error('❌ [WEBHOOK] Failed to assign voucher:', assignError);
            }
          } else {
            console.warn(`⚠️ [WEBHOOK] No available voucher for session ${sessionId} — manual assignment required for ${email}`);
          }
        } catch (voucherError) {
          console.error('❌ [WEBHOOK] Voucher assignment error (non-fatal):', voucherError);
        }
      } else {
        console.error('❌ [WEBHOOK] Enrollment failed:', { result, sessionId, email });
      }
    }

    // Send a confirmation email ONLY if the webhook actually created enrollments
    // (i.e., the checkout flow failed). In the happy path, the checkout route
    // has already sent this email and createdByWebhook is empty.
    if (createdByWebhook.length > 0) {
      await sendEnrollmentConfirmation(
        email,
        {
          name,
          className: createdByWebhook[0].className,
          date: createdByWebhook[0].date,
          time: createdByWebhook[0].time,
        },
        { enrollmentId: createdByWebhook[0].enrollmentId }
      );
    }
  }

  return NextResponse.json({ received: true })
}
