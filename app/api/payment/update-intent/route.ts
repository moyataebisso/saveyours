import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { browserOwnsPi } from '@/lib/payment-auth'

export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId, name, email, phone } = await req.json()

    if (!paymentIntentId || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (typeof paymentIntentId !== 'string') {
      return NextResponse.json({ error: 'Invalid paymentIntentId' }, { status: 400 })
    }

    // Ownership check (approach B): the caller's signed cookie must include
    // this PI id. Cross-browser or leaked-id callers get 401.
    if (!browserOwnsPi(req, paymentIntentId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Status check (approach C, layered): only allow the update while the PI
    // is still awaiting a payment method. A completed PI must not have its
    // receipt_email rewritten.
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (existing.status !== 'requires_payment_method') {
      return NextResponse.json(
        { error: `Cannot update payment in status "${existing.status}"` },
        { status: 409 }
      )
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { name, email, phone: phone || '' },
      receipt_email: email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update intent error:', error)
    return NextResponse.json({ error: 'Failed to update payment intent' }, { status: 500 })
  }
}
