import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-server'
import { supabase, supabaseHelpers } from '@/lib/supabase'
import { sendEnrollmentConfirmation, sendVoucherEmail } from '@/lib/email'

// Mirrors the formatTime helper in app/api/enrollment/create/route.ts.
// The voucher/confirmation emails render the time string as-is (see
// lib/email.ts commit 035ffd9), so callers MUST pre-format to avoid the
// double-format garbage bug.
function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

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

type ReconcileNotification = {
  sessionId: string
  className?: string
  confirmationSent: boolean
  voucherAssigned: boolean
  voucherEmailSent: boolean
  warning?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { paymentIntentId, sendEmails: sendEmailsRaw } = body as {
      paymentIntentId?: string
      sendEmails?: boolean
    }
    const sendEmails = sendEmailsRaw === true

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
    const notifications: ReconcileNotification[] = []

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
        continue
      }

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

      if (!sendEmails) continue

      // Per-enrollment try/catch: an email/voucher failure NEVER aborts the loop,
      // rolls back the enrollment, or fails the request. The seat is taken; the
      // admin can send anything that failed manually from the dashboard.
      const notification: ReconcileNotification = {
        sessionId,
        className: session?.class?.name,
        confirmationSent: false,
        voucherAssigned: false,
        voucherEmailSent: false,
      }

      if (!session) {
        notification.warning = `Session ${sessionId} not found — could not send emails.`
        console.warn(`[RECONCILE] ${notification.warning}`)
        notifications.push(notification)
        continue
      }

      try {
        // Mirror app/api/enrollment/create/route.ts: pre-format the time string.
        // sendVoucherEmail renders time as-is (035ffd9), so double-formatting
        // would produce "9:00 AM AM" garbage.
        const preFormattedTime = `${formatTime(session.start_time)} - ${formatTime(session.end_time)}`
        const className = session.class?.name || 'your class'
        const sessionDate = session.date

        // 1. Voucher lookup + assign + voucher email
        const { data: voucher, error: voucherError } = await supabaseHelpers.getAvailableVoucher(sessionId)
        if (voucherError) {
          console.error('[RECONCILE] Error fetching available voucher:', voucherError)
        }

        if (voucher) {
          const { error: assignError } = await supabaseHelpers.assignVoucher(voucher.id, email)
          if (!assignError) {
            notification.voucherAssigned = true
            const voucherEmailResult = await sendVoucherEmail(email, {
              name,
              className,
              date: sessionDate,
              time: preFormattedTime,
              voucherUrl: voucher.voucher_url,
            })
            if (voucherEmailResult?.success) {
              notification.voucherEmailSent = true
            } else {
              console.error('[RECONCILE] Voucher email did not succeed:', voucherEmailResult)
            }
          } else {
            console.error('[RECONCILE] Failed to assign voucher:', assignError)
          }
        } else {
          notification.warning = `No voucher available for session ${sessionId} (${className}). Upload vouchers for this session and assign one manually.`
          console.warn(`[RECONCILE] No available voucher for session ${sessionId} — manual assignment required for ${email}`)
        }

        // 2. Confirmation email — always, regardless of voucher outcome
        const confResult = await sendEnrollmentConfirmation(email, {
          name,
          className,
          date: sessionDate,
          time: preFormattedTime,
        })
        if (confResult?.success) {
          notification.confirmationSent = true
        } else {
          console.error('[RECONCILE] Confirmation email did not succeed:', confResult)
        }
      } catch (emailError) {
        console.error('[RECONCILE] Email/voucher block failed (non-fatal):', emailError)
      }

      notifications.push(notification)
    }

    return NextResponse.json({ created, errors, notifications })
  } catch (error) {
    console.error('Manual enrollment creation error:', error)
    return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 })
  }
}
