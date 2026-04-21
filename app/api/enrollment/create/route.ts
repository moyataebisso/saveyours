import { NextRequest, NextResponse } from 'next/server'
import { supabaseHelpers } from '@/lib/supabase'
import { stripe } from '@/lib/stripe-server'
import { sendEnrollmentConfirmation, sendVoucherEmail } from '@/lib/email'

// Called from the checkout success flow (app/cart/page.tsx) immediately after
// stripe.confirmPayment() resolves. This is now the PRIMARY path for creating
// enrollments and sending confirmation/voucher emails — the Stripe webhook
// acts as a fallback (see app/api/webhook/stripe/route.ts).
//
// Enrollments are created with payment_status='pending'; the webhook flips
// them to 'paid' once Stripe delivers the payment_intent.succeeded event.
export async function POST(req: NextRequest) {
  try {
    const {
      sessionIds,
      sessionId,
      email,
      name,
      phone,
      paymentIntentId,
    } = await req.json()

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

    const enrolledClasses: { className: string; date: string; time: string }[] = []

    for (const sid of ids) {
      // If the webhook beat us to this enrollment (rare, but possible on slow
      // clients / fast webhook delivery), skip to avoid duplicate emails.
      const { data: existing } = await supabaseHelpers.getEnrollmentByPaymentIntent(
        paymentIntent.id,
        sid
      )
      if (existing) {
        console.log(
          `[ENROLLMENT] Enrollment already exists for ${paymentIntent.id}/${sid} — webhook handled it`
        )
        continue
      }

      const { data: session } = await supabaseHelpers.getSessionById(sid)
      if (!session) {
        console.error(`[ENROLLMENT] Session not found: ${sid}`)
        continue
      }

      // Use the atomic RPC for the capacity check + insert so we can't overbook
      // even under concurrent checkouts.
      const { data: result, error: rpcError } = await supabaseHelpers.enrollStudentIfCapacity({
        session_id: sid,
        guest_name: name,
        guest_email: email,
        phone: phone || '',
        stripe_payment_intent_id: paymentIntent.id,
        amount_paid: session.class.price,
      })

      if (rpcError) {
        console.error('[ENROLLMENT] RPC error for session:', { rpcError, sid, email })
        continue
      }

      if (!result || !result.success) {
        // CLASS_FULL or other failure — the webhook will catch this case and
        // issue the refund + send the refund-notification email.
        console.warn('[ENROLLMENT] Enrollment did not succeed; leaving to webhook:', {
          result,
          sid,
          email,
        })
        continue
      }

      // Payment hasn't been confirmed by the webhook yet — mark pending.
      // The webhook will flip this to 'paid'.
      if (result.enrollment_id) {
        const { error: statusError } = await supabaseHelpers.updateEnrollmentPaymentStatus(
          result.enrollment_id,
          'pending'
        )
        if (statusError) {
          console.error('[ENROLLMENT] Failed to set payment_status=pending:', statusError)
        }
      }

      enrolledClasses.push({
        className: session.class.name,
        date: session.date,
        time: session.start_time,
      })

      // Assign and send the voucher email for this session. Voucher failures
      // are non-fatal — admin can assign manually from the dashboard.
      try {
        const { data: voucher, error: voucherError } = await supabaseHelpers.getAvailableVoucher(sid)
        if (voucherError) {
          console.error('[ENROLLMENT] Error fetching available voucher:', voucherError)
        }

        if (voucher) {
          const { error: assignError } = await supabaseHelpers.assignVoucher(voucher.id, email)
          if (!assignError) {
            await sendVoucherEmail(email, {
              name,
              className: session.class.name,
              date: session.date,
              time: session.start_time,
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
        const result = await sendEnrollmentConfirmation(email, {
          name,
          className: enrolledClasses[0].className,
          date: enrolledClasses[0].date,
          time: enrolledClasses[0].time,
        })
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
    })
  } catch (error) {
    console.error('Enrollment creation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
