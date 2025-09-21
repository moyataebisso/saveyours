// Update app/api/payment/create-intent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { supabaseHelpers } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, totalAmount } = await req.json()

    // If totalAmount is provided, use it (for multiple items)
    let amount = totalAmount;
    
    // If not, get single session price
    if (!totalAmount) {
      const { data: session, error } = await supabaseHelpers.getSessionById(sessionId)
      
      if (error || !session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      
      amount = session.class.price;
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        sessionId,
        totalAmount: amount.toString()
      },
    })

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      amount,
      paymentIntentId: paymentIntent.id
    })
  } catch (error) {
    console.error('Payment intent error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}