import { NextRequest, NextResponse } from 'next/server'
import { supabaseHelpers } from '@/lib/supabase'
import { stripe } from '@/lib/stripe-server'  // Changed from '@/lib/stripe'
import { sendEnrollmentConfirmation } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { 
      sessionId, 
      email, 
      name, 
      phone,
      paymentIntentId 
    } = await req.json()

    // Verify the payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not confirmed' }, { status: 400 })
    }

    // Get session details
    const { data: session } = await supabaseHelpers.getSessionById(sessionId)
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Create enrollment in database
    const { data: enrollment, error } = await supabaseHelpers.createEnrollment({
      session_id: sessionId,
      guest_email: email,
      guest_name: name,
      amount_paid: paymentIntent.amount / 100,
      stripe_payment_intent_id: paymentIntent.id,
    })

    if (error) {
      console.error('Enrollment error:', error)
      return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 })
    }

    // Send confirmation email
    await sendEnrollmentConfirmation(email, {
      name,
      className: session.class.name,
      date: session.date,
      time: `${session.start_time} - ${session.end_time}`,
    })

    return NextResponse.json({ success: true, enrollmentId: enrollment?.id })
  } catch (error) {
    console.error('Enrollment creation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}