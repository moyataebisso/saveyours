import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { supabaseHelpers } from '@/lib/supabase'
import { sendEnrollmentConfirmation, sendVoucherEmail, sendAdminAlert } from '@/lib/email'
import Stripe from 'stripe'

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

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const metadata = paymentIntent.metadata

    const name = metadata.name || metadata.customer_name || 'Unknown - check Stripe'
    const email = metadata.email || metadata.receipt_email || paymentIntent.receipt_email || 'unknown@saveyours.net'
    const phone = metadata.phone || ''

    if (!metadata.name || !metadata.email) {
      console.error('MISSING METADATA for payment:', paymentIntent.id, 'amount:', paymentIntent.amount)
      sendAdminAlert(
        '⚠️ SaveYours - Payment with missing data detected',
        `<h2>Payment with Missing Data</h2>
        <p>A payment succeeded in Stripe but is missing customer metadata.</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;font-weight:bold;">Payment Intent ID:</td><td style="padding:8px;">${paymentIntent.id}</td></tr>
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

    // Create enrollment for EACH session
    const enrolledClasses: { className: string; date: string; time: string }[] = [];

    for (const sessionId of sessionIds) {
      const { data: session } = await supabaseHelpers.getSessionById(sessionId);

      if (session) {
        // Create enrollment with individual class price
        const { data: enrollment, error } = await supabaseHelpers.createEnrollment({
          session_id: sessionId,
          guest_email: email,
          guest_name: name,
          amount_paid: session.class.price,
          stripe_payment_intent_id: paymentIntent.id,
        });

        if (!error && enrollment) {
          console.log('🎟️ [WEBHOOK] Enrollment created successfully:', {
            enrollmentId: enrollment.id,
            sessionId,
            email
          });

          enrolledClasses.push({
            className: session.class.name,
            date: session.date,
            time: session.start_time
          });

          // Try to assign and send voucher for each session
          console.log('🎟️ [WEBHOOK] Starting voucher assignment process for session:', sessionId);
          try {
            const { data: voucher, error: voucherError } = await supabaseHelpers.getAvailableVoucher(sessionId);

            console.log('🎟️ [WEBHOOK] getAvailableVoucher returned:', {
              hasVoucher: !!voucher,
              voucherId: voucher?.id,
              voucherError
            });

            if (voucherError) {
              console.error('🎟️ [WEBHOOK] Error getting available voucher:', voucherError);
            }

            if (voucher) {
              console.log('🎟️ [WEBHOOK] Found voucher, attempting to assign:', voucher.id);
              const { data: assignedVoucher, error: assignError } = await supabaseHelpers.assignVoucher(voucher.id, email);

              console.log('🎟️ [WEBHOOK] assignVoucher returned:', {
                success: !assignError,
                assignedVoucher: assignedVoucher?.id,
                assignError
              });

              if (!assignError) {
                console.log('🎟️ [WEBHOOK] Voucher assigned, sending email...');
                const emailResult = await sendVoucherEmail(email, {
                  name,
                  className: session.class.name,
                  date: session.date,
                  time: session.start_time,
                  voucherUrl: voucher.voucher_url,
                });
                console.log('🎟️ [WEBHOOK] Voucher email result:', emailResult);
                console.log(`✅ Voucher email sent to ${email} for session ${sessionId}`);
              } else {
                console.error('❌ [WEBHOOK] Failed to assign voucher:', assignError);
              }
            } else {
              console.warn(`⚠️ [WEBHOOK] No available voucher for session ${sessionId} - student ${email} will need manual voucher assignment`);
            }
          } catch (voucherError) {
            console.error('❌ [WEBHOOK] Voucher assignment error (non-fatal):', voucherError);
          }
        } else {
          console.error('❌ [WEBHOOK] Enrollment creation failed:', { error, sessionId, email });
        }
      }
    }

    // Send single confirmation email with first enrolled class info
    if (enrolledClasses.length > 0) {
      await sendEnrollmentConfirmation(email, {
        name,
        className: enrolledClasses[0].className,
        date: enrolledClasses[0].date,
        time: enrolledClasses[0].time,
      });
    }
  }

  return NextResponse.json({ received: true })
}