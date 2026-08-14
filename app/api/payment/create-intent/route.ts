import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { stripe } from '@/lib/stripe-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  issuePiOwnershipCookie,
  PI_COOKIE_NAME,
  PI_COOKIE_OPTIONS,
} from '@/lib/payment-auth'

// Defense-in-depth ceiling. A single cart across a few classes should be far
// under this. Any request that hits it either indicates a bug or an attempt to
// force a very large charge — either way it should surface as a 400 and be
// logged for review, not silently succeed.
const MAX_AMOUNT_USD = 2000

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}))

    // Reject any legacy or attacker-supplied amount field with a hard 400.
    // The amount is derived server-side from class prices — the client must
    // NOT be able to influence it in any way.
    if (
      rawBody &&
      typeof rawBody === 'object' &&
      ('totalAmount' in rawBody || 'amount' in rawBody)
    ) {
      return NextResponse.json(
        { error: 'Do not send totalAmount or amount; the amount is computed server-side.' },
        { status: 400 }
      )
    }

    const { sessionId, sessionIds, idempotencyKey: clientIdempotencyKey } = rawBody as {
      sessionId?: string
      sessionIds?: string[]
      idempotencyKey?: string
    }

    // Accept either a single sessionId (legacy) or an array of sessionIds.
    const ids: string[] = Array.isArray(sessionIds) && sessionIds.length > 0
      ? sessionIds
      : (typeof sessionId === 'string' && sessionId ? [sessionId] : [])

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No session IDs provided' }, { status: 400 })
    }
    if (ids.length > 20) {
      return NextResponse.json({ error: 'Too many sessions' }, { status: 400 })
    }
    if (!ids.every((id) => typeof id === 'string' && id.length > 0 && id.length < 100)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    // Load every session referenced and sum server-authoritative prices. Any
    // missing session, missing class, or non-numeric price aborts the entire
    // request rather than silently omitting the item from the total.
    const sessionDetails: Array<{
      id: string
      date: string
      start_time: string
      current_enrollment: number
      max_capacity: number
      class: { name: string; price: number }
    }> = []
    let amount = 0

    for (const id of ids) {
      const { data: session, error } = await supabaseAdmin
        .from('class_sessions')
        .select('id, date, start_time, current_enrollment, max_capacity, class:classes(name, price)')
        .eq('id', id)
        .maybeSingle()

      if (error || !session) {
        return NextResponse.json({ error: `Session not found: ${id}` }, { status: 404 })
      }

      const cls = Array.isArray(session.class) ? session.class[0] : session.class
      if (!cls || typeof cls.price !== 'number' || !Number.isFinite(cls.price) || cls.price < 0) {
        console.error('[CREATE_INTENT] Session missing valid price:', { id, session })
        return NextResponse.json({ error: 'Invalid session pricing' }, { status: 500 })
      }

      sessionDetails.push({
        id: session.id,
        date: session.date,
        start_time: session.start_time,
        current_enrollment: session.current_enrollment,
        max_capacity: session.max_capacity,
        class: { name: cls.name, price: cls.price },
      })
      amount += cls.price
    }

    // Capacity check across all sessions before we create a PaymentIntent.
    for (const session of sessionDetails) {
      if (session.current_enrollment >= session.max_capacity) {
        return NextResponse.json({
          error: `Class "${session.class.name}" is full`,
        }, { status: 400 })
      }
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid total amount' }, { status: 400 })
    }
    if (amount > MAX_AMOUNT_USD) {
      console.warn('[CREATE_INTENT] Amount ceiling hit', {
        amount,
        MAX_AMOUNT_USD,
        sessionIds: ids,
      })
      return NextResponse.json({ error: 'Total exceeds allowed maximum' }, { status: 400 })
    }

    // Idempotency: prefer a client-supplied UUID so a legitimate retry (double
    // click, network blip) does not create a duplicate PaymentIntent. If the
    // client did not send one, generate a random key so we still call Stripe
    // with idempotency headers.
    const idempotencyKey =
      typeof clientIdempotencyKey === 'string' &&
      /^[A-Za-z0-9._~-]{8,128}$/.test(clientIdempotencyKey)
        ? clientIdempotencyKey
        : crypto.randomUUID()

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amount * 100),
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          sessionIds: JSON.stringify(ids),
          sessionCount: ids.length.toString(),
          sessionId: ids[0],
          totalAmount: amount.toString(),
          className: sessionDetails[0].class.name,
          classDate: sessionDetails[0].date,
          classTime: sessionDetails[0].start_time,
        },
      },
      { idempotencyKey }
    )

    // Sign the new PI id into the browser's ownership cookie so update-intent
    // and cancel-intent can verify the caller actually created this PI. Any
    // previously owned ids in the cookie are preserved (deduped, capped).
    const cookie = issuePiOwnershipCookie(req, paymentIntent.id)

    const res = NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount,
      paymentIntentId: paymentIntent.id,
    })
    res.cookies.set(PI_COOKIE_NAME, cookie.value, {
      ...PI_COOKIE_OPTIONS,
      maxAge: cookie.maxAge,
    })
    return res
  } catch (error) {
    console.error('Payment intent error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
