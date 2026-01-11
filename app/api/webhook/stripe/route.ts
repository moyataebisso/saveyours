import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { supabaseHelpers } from '@/lib/supabase'
import { sendEnrollmentConfirmation, sendVoucherEmail } from '@/lib/email'
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
    const { sessionId, email, name, phone, className, classDate, classTime } = metadata

    // Create enrollment in database
    const { data: enrollment, error } = await supabaseHelpers.createEnrollment({
      session_id: sessionId,
      guest_email: email,
      guest_name: name,
      amount_paid: paymentIntent.amount / 100,
      stripe_payment_intent_id: paymentIntent.id,
    })

    if (!error && enrollment) {
      // Send confirmation email
      await sendEnrollmentConfirmation(email, {
        name,
        className,
        date: classDate,
        time: classTime,
      })

      // Try to assign and send voucher email
      try {
        const { data: voucher } = await supabaseHelpers.getAvailableVoucher(sessionId)

        if (voucher) {
          // Assign the voucher to this student
          const { error: assignError } = await supabaseHelpers.assignVoucher(voucher.id, email)

          if (!assignError) {
            // Send the voucher email
            await sendVoucherEmail(email, {
              name,
              className,
              date: classDate,
              time: classTime,
              voucherUrl: voucher.voucher_url,
            })
            console.log(`Voucher email sent to ${email} for session ${sessionId}`)
          } else {
            console.error('Failed to assign voucher:', assignError)
          }
        } else {
          console.warn(`No available voucher for session ${sessionId} - student ${email} will need manual voucher assignment`)
        }
      } catch (voucherError) {
        // Don't fail the whole transaction if voucher assignment fails
        console.error('Voucher assignment error (non-fatal):', voucherError)
      }
    }
  }

  return NextResponse.json({ received: true })
}