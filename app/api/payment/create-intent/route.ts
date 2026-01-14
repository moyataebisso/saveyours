import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { supabaseHelpers } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, sessionIds, totalAmount } = await req.json()

    // Handle both single sessionId and array of sessionIds
    const ids: string[] = sessionIds || (sessionId ? [sessionId] : []);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No session IDs provided' }, { status: 400 })
    }

    // Get all session details and calculate amount if not provided
    let amount = totalAmount;
    const sessionDetails: any[] = [];

    for (const id of ids) {
      const { data: session, error } = await supabaseHelpers.getSessionById(id)
      if (!error && session) {
        sessionDetails.push(session);
        if (!amount) {
          amount = (amount || 0) + session.class.price;
        }
      }
    }

    if (sessionDetails.length === 0) {
      return NextResponse.json({ error: 'No valid sessions found' }, { status: 404 })
    }

    // Check capacity for all sessions
    for (const session of sessionDetails) {
      if (session.current_enrollment >= session.max_capacity) {
        return NextResponse.json({
          error: `Class "${session.class.name}" is full`
        }, { status: 400 })
      }
    }

    // Create Stripe Payment Intent with ALL session IDs in metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        sessionIds: JSON.stringify(ids), // Store ALL session IDs
        sessionCount: ids.length.toString(),
        // For backwards compatibility, also store first session details
        sessionId: ids[0],
        totalAmount: amount.toString(),
        className: sessionDetails[0].class.name,
        classDate: sessionDetails[0].date,
        classTime: sessionDetails[0].start_time
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