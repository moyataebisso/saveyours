import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  verifyRescheduleToken,
  checkEligibility,
  rescheduleFee,
} from '@/lib/reschedule'

// POST /api/reschedule/checkout
// body: { token, toSessionId }
// Server-side: re-verify token + full eligibility, insert a reschedule_requests
// row (status='pending'), create a Stripe Checkout Session with
// metadata.type='reschedule' on BOTH the session and payment_intent_data.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string
    toSessionId?: string
  }
  const { token, toSessionId } = body
  if (!token || !toSessionId) {
    return NextResponse.json({ error: 'Missing token or toSessionId' }, { status: 400 })
  }

  const verify = verifyRescheduleToken(token)
  if (verify.ok !== true) {
    const reason = (verify as { reason?: string }).reason
    return NextResponse.json(
      { error: reason === 'expired' ? 'This reschedule link has expired.' : 'Invalid reschedule link.' },
      { status: 401 }
    )
  }
  const enrollmentId = verify.enrollmentId

  // Pull the enrollment row with its CURRENT session + class so we can both
  // run eligibility and prefill the Checkout line-item label.
  const { data: enrollmentRow, error: enrollErr } = await supabaseAdmin
    .from('enrollments')
    .select(
      'id, status, amount_paid, guest_email, guest_name, session_id, session:class_sessions(id, date, start_time, end_time, status, archived_at, current_enrollment, max_capacity, class_id, class:classes(id, name, price))'
    )
    .eq('id', enrollmentId)
    .maybeSingle()

  if (enrollErr) {
    console.error('[RESCHEDULE_CHECKOUT] Enrollment lookup failed:', enrollErr)
    return NextResponse.json({ error: 'Could not load enrollment' }, { status: 500 })
  }
  if (!enrollmentRow) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const fromSessionAny = (enrollmentRow as { session?: unknown }).session
  const fromRaw = Array.isArray(fromSessionAny) ? fromSessionAny[0] : fromSessionAny
  const fromClassAny = fromRaw && typeof fromRaw === 'object' ? (fromRaw as { class?: unknown }).class : null
  const fromClass = Array.isArray(fromClassAny) ? fromClassAny[0] : fromClassAny
  if (!fromRaw || typeof fromRaw !== 'object' || !fromClass || typeof fromClass !== 'object') {
    return NextResponse.json({ error: 'Enrollment is missing its session or class' }, { status: 500 })
  }
  const fromSession = fromRaw as {
    id: string
    date: string
    start_time: string
    end_time: string
    status: string | null
    archived_at: string | null
    current_enrollment: number
    max_capacity: number
    class_id: string
  }
  const cls = fromClass as { id: string; name: string; price: number }

  // Pull the target session.
  const { data: targetRow, error: targetErr } = await supabaseAdmin
    .from('class_sessions')
    .select('id, date, start_time, end_time, status, archived_at, current_enrollment, max_capacity, class_id')
    .eq('id', toSessionId)
    .maybeSingle()
  if (targetErr) {
    console.error('[RESCHEDULE_CHECKOUT] Target lookup failed:', targetErr)
    return NextResponse.json({ error: 'Could not load target session' }, { status: 500 })
  }
  if (!targetRow) {
    return NextResponse.json({ error: 'Target session not found' }, { status: 404 })
  }

  // Authoritative seat count — see /api/payment/create-intent for the same
  // pattern. Trusting current_enrollment lets a drifted counter pass the gate.
  const { count: seatsTakenCount } = await supabaseAdmin
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', toSessionId)
    .neq('status', 'cancelled')

  const eligibility = checkEligibility({
    enrollment: { status: enrollmentRow.status, session_id: enrollmentRow.session_id },
    fromSession,
    toSession: targetRow,
    now: new Date(),
    toSessionSeatsTaken: seatsTakenCount ?? 0,
  })
  if (eligibility.ok !== true) {
    const message = (eligibility as { message?: string }).message ?? 'Not eligible to reschedule.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const feeCents = rescheduleFee(enrollmentRow.amount_paid, cls.price)
  if (feeCents <= 0) {
    console.error('[RESCHEDULE_CHECKOUT] Computed fee is 0 — refusing to create a $0 Stripe session:', {
      enrollmentId,
      amountPaid: enrollmentRow.amount_paid,
      classPrice: cls.price,
    })
    return NextResponse.json({ error: 'Could not compute a reschedule fee for this enrollment.' }, { status: 500 })
  }

  // Insert the pending request FIRST so the Checkout Session metadata can
  // reference its id. If the Stripe call then fails we leave a stray pending
  // row — admin can clean these up and they're harmless (no money moved).
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('reschedule_requests')
    .insert({
      enrollment_id: enrollmentId,
      from_session_id: fromSession.id,
      to_session_id: targetRow.id,
      fee_amount: feeCents / 100,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('[RESCHEDULE_CHECKOUT] Insert pending request failed:', insertErr)
    return NextResponse.json({ error: 'Could not start reschedule' }, { status: 500 })
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://saveyours.net').replace(/\/+$/, '')
  const successUrl = `${base}/reschedule/success?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${base}/reschedule?token=${encodeURIComponent(token)}`

  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: enrollmentRow.guest_email ?? undefined,
      expires_at: expiresAt,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: feeCents,
            product_data: {
              name: `Reschedule fee — ${cls.name}`,
              description: `From ${fromSession.date} to ${targetRow.date}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'reschedule',
        reschedule_request_id: inserted.id,
        enrollment_id: enrollmentId,
      },
      // The webhook listens on payment_intent.* and checkout.session.*; the
      // PI needs the same marker so the enrollment webhook can SKIP it (it
      // uses payment_intent.succeeded to create enrollments otherwise).
      payment_intent_data: {
        metadata: {
          type: 'reschedule',
          reschedule_request_id: inserted.id,
          enrollment_id: enrollmentId,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    // Record the Stripe id on the pending row so the webhook / success page
    // can look it up by either id.
    await supabaseAdmin
      .from('reschedule_requests')
      .update({ stripe_checkout_session_id: checkoutSession.id })
      .eq('id', inserted.id)

    return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id })
  } catch (err) {
    console.error('[RESCHEDULE_CHECKOUT] Stripe create failed:', err)
    // Leave the pending row for admin to review. Don't delete it — a Stripe
    // failure mid-create could still leave a session on their side.
    return NextResponse.json({ error: 'Could not start payment' }, { status: 500 })
  }
}
