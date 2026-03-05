import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'

export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId, name, email, phone } = await req.json()

    if (!paymentIntentId || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: { name, email, phone: phone || '' },
      receipt_email: email
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update intent error:', error)
    return NextResponse.json({ error: 'Failed to update payment intent' }, { status: 500 })
  }
}
