import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseHelpers } from '@/lib/supabase'
import { sendEnrollmentConfirmation } from '@/lib/email'
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
    }
  }

  return NextResponse.json({ received: true })
}