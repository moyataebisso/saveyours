import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { browserOwnsPi } from '@/lib/payment-auth'

export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId } = await req.json()

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return NextResponse.json({ error: 'No payment intent ID' }, { status: 400 })
    }

    // Ownership check (approach B): only the browser that created this PI
    // may cancel it. Prevents attackers from cancelling a stranger's
    // in-progress checkout via a leaked PI id.
    if (!browserOwnsPi(req, paymentIntentId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Status check (approach C, layered): only cancel while the PI is still
    // pending payment. Anything else (succeeded, canceled, processing) is a
    // no-op success — this route runs as cart cleanup and must not surface
    // errors for benign state transitions.
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (existing.status !== 'requires_payment_method') {
      return NextResponse.json({ success: true })
    }

    await stripe.paymentIntents.cancel(paymentIntentId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    // Stripe returns this when a PI is already in a non-cancelable state.
    if (error?.code === 'payment_intent_unexpected_state') {
      return NextResponse.json({ success: true })
    }
    console.error('Cancel intent error:', error)
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
  }
}
