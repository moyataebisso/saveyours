import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const payments = await stripe.paymentIntents.list({
      limit: 100,
      expand: ['data.customer']
    })
    const succeeded = payments.data.filter(p => p.status === 'succeeded')

    const results: {
      ok: { paymentId: string; amount: number; name: string; email: string }[]
      incomplete: { paymentId: string; amount: number; enrollmentId: string; name: string | null; email: string | null }[]
      missing: { paymentId: string; amount: number; created: number; name: string | null; email: string | null; metadata: Record<string, string> }[]
    } = {
      ok: [],
      incomplete: [],
      missing: []
    }

    for (const payment of succeeded) {
      const { data: existing } = await supabase
        .from('enrollments')
        .select('id, guest_name, guest_email')
        .eq('stripe_payment_intent_id', payment.id)
        .limit(1)

      const enrollment = existing && existing.length > 0 ? existing[0] : null

      if (!enrollment) {
        // No enrollment row at all
        const name = payment.metadata?.name || payment.metadata?.customer_name || null
        const email = payment.metadata?.email || payment.receipt_email || null
        results.missing.push({
          paymentId: payment.id,
          amount: payment.amount / 100,
          created: payment.created,
          name,
          email,
          metadata: payment.metadata || {}
        })
      } else if (!enrollment.guest_name || !enrollment.guest_email) {
        // Enrollment exists but missing data
        results.incomplete.push({
          paymentId: payment.id,
          amount: payment.amount / 100,
          enrollmentId: enrollment.id,
          name: enrollment.guest_name,
          email: enrollment.guest_email
        })
      } else {
        results.ok.push({
          paymentId: payment.id,
          amount: payment.amount / 100,
          name: enrollment.guest_name,
          email: enrollment.guest_email
        })
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { paymentIntentId } = await req.json()

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Missing paymentIntentId' }, { status: 400 })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not succeeded' }, { status: 400 })
    }

    const metadata = paymentIntent.metadata || {}
    const name = metadata.name || metadata.customer_name || 'Unknown - check Stripe'
    const email = metadata.email || paymentIntent.receipt_email || 'unknown@saveyours.net'

    // Get session IDs from metadata
    let sessionIds: string[] = []
    if (metadata.sessionIds) {
      try { sessionIds = JSON.parse(metadata.sessionIds) } catch { /* empty */ }
    }
    if (sessionIds.length === 0 && metadata.sessionId) {
      sessionIds = [metadata.sessionId]
    }

    if (sessionIds.length === 0) {
      return NextResponse.json({ error: 'No session IDs found in payment metadata' }, { status: 400 })
    }

    const created: string[] = []
    const errors: string[] = []

    for (const sessionId of sessionIds) {
      // Check if enrollment already exists for this session + payment combo
      const { data: existing } = await supabase
        .from('enrollments')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .eq('session_id', sessionId)
        .limit(1)

      if (existing && existing.length > 0) {
        errors.push(`Enrollment already exists for session ${sessionId}`)
        continue
      }

      const { data: session } = await supabase
        .from('class_sessions')
        .select('*, class:classes(*)')
        .eq('id', sessionId)
        .single()

      const amountPaid = session?.class?.price || paymentIntent.amount / 100

      const { data: enrollment, error } = await supabase
        .from('enrollments')
        .insert([{
          session_id: sessionId,
          guest_email: email,
          guest_name: name,
          amount_paid: amountPaid,
          stripe_payment_intent_id: paymentIntentId,
          status: 'confirmed',
          payment_status: 'paid',
          enrolled_at: new Date(paymentIntent.created * 1000).toISOString()
        }])
        .select()
        .single()

      if (error) {
        errors.push(`Failed to create enrollment for session ${sessionId}: ${error.message}`)
      } else {
        created.push(enrollment.id)

        // Increment session enrollment count
        if (session) {
          const newCount = (session.current_enrollment || 0) + 1
          await supabase
            .from('class_sessions')
            .update({
              current_enrollment: newCount,
              status: newCount >= session.max_capacity ? 'full' : 'scheduled'
            })
            .eq('id', sessionId)
        }
      }
    }

    return NextResponse.json({ created, errors })
  } catch (error) {
    console.error('Manual enrollment creation error:', error)
    return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 })
  }
}
