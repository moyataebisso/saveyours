import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEnrollmentConfirmation, sendAdminAlert, escapeHtml } from '@/lib/email'
import { stripe as sharedStripe } from '@/lib/stripe-server'
import type Stripe from 'stripe'
import { supabaseAdmin as sharedSupabaseAdmin } from '@/lib/supabase-admin'

// Shape of the subset of Stripe we touch. Kept narrow so tests can hand us
// a minimal mock without constructing the whole SDK.
export interface StripeLike {
  checkout: {
    sessions: {
      retrieve: (
        id: string,
        params?: Stripe.Checkout.SessionRetrieveParams
      ) => Promise<Stripe.Checkout.Session>
    }
  }
}

export type CompleteOutcome =
  | { status: 'ok'; newSessionId: string }
  | { status: 'already_processed' }
  | { status: 'not_paid' }
  | { status: 'not_found' }
  | {
      status: 'rpc_failed'
      // one of: not_found | enrollment_cancelled | same_session |
      // different_class | target_unavailable | target_in_past | full
      // (the full set the DB function can return).
      rpcResult: string
      /** True if the fee is money-paid but the seat move failed. */
      paidButUnmoved: boolean
    }

function formatTime(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

export interface CompleteDeps {
  supabase?: SupabaseClient
  stripe?: StripeLike
}

// Idempotent completion of a reschedule after Stripe signals the fee was paid.
// Called from BOTH the webhook (checkout.session.completed) and the success
// page (as a safety net if the webhook is delayed). The DB-level "claim" (the
// first UPDATE below with the `status='pending'` guard) is what guarantees
// exactly-once semantics — only the caller whose UPDATE affected a row proceeds
// to call the RPC and send emails.
export async function completeReschedule(
  checkoutSessionId: string,
  deps: CompleteDeps = {}
): Promise<CompleteOutcome> {
  const supabase = deps.supabase ?? sharedSupabaseAdmin
  const stripe = deps.stripe ?? (sharedStripe as unknown as StripeLike)

  // Pull the Checkout Session from Stripe to re-verify payment status and
  // read the metadata. Trusting metadata alone is unsafe — webhook signatures
  // and the success page's own call to this function both must verify.
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId)
  if (!session) return { status: 'not_found' }
  if (session.payment_status !== 'paid') return { status: 'not_paid' }

  const metadata = (session.metadata ?? {}) as Record<string, string>
  const rescheduleRequestId = metadata.reschedule_request_id
  if (!rescheduleRequestId) {
    console.error('[RESCHEDULE_COMPLETE] Missing reschedule_request_id in metadata:', {
      checkoutSessionId,
    })
    return { status: 'not_found' }
  }

  // Atomic claim. Only one caller flips pending → processing. The .select()
  // returns the row IFF our UPDATE affected it; a second caller sees zero
  // rows and short-circuits to already_processed.
  const { data: claimed, error: claimErr } = await supabase
    .from('reschedule_requests')
    .update({ status: 'processing' })
    .eq('id', rescheduleRequestId)
    .eq('status', 'pending')
    .select('id, enrollment_id, from_session_id, to_session_id, fee_amount')
    .maybeSingle()

  if (claimErr) {
    console.error('[RESCHEDULE_COMPLETE] Claim UPDATE failed:', claimErr)
    return { status: 'not_found' }
  }
  if (!claimed) {
    // Either already-processed (completed / failed_full / processing) or the
    // id simply doesn't match a pending row. Either way nothing to do.
    console.log('[RESCHEDULE_COMPLETE] Already processed or not pending:', {
      rescheduleRequestId,
    })
    return { status: 'already_processed' }
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null

  // Call the DB function that enforces capacity + swaps the enrollment seat.
  // The function is `reschedule_enrollment(p_enrollment_id, p_to_session_id)`
  // and returns one of: ok | not_found | enrollment_cancelled | same_session
  // | different_class | target_unavailable | target_in_past | full.
  const { data: rpcResult, error: rpcError } = await supabase.rpc('reschedule_enrollment', {
    p_enrollment_id: claimed.enrollment_id,
    p_to_session_id: claimed.to_session_id,
  }) as { data: string | null; error: unknown }

  if (rpcError) {
    console.error('[RESCHEDULE_COMPLETE] RPC threw — leaving request in processing for admin review:', {
      rescheduleRequestId,
      rpcError,
    })
    // The request stays in 'processing' which is visible to admin. Do NOT
    // flip to 'failed' automatically — a transient Supabase blip would
    // falsely mark a recoverable situation as permanent.
    return { status: 'rpc_failed', rpcResult: 'rpc_threw', paidButUnmoved: true }
  }

  if (rpcResult === 'ok') {
    // Load the enrollment + its NEW session so we can resend the confirmation
    // email and update the request row.
    const { data: enrollmentRow } = await supabase
      .from('enrollments')
      .select('id, guest_name, guest_email, session:class_sessions(id, date, start_time, end_time, class:classes(name))')
      .eq('id', claimed.enrollment_id)
      .maybeSingle()

    await supabase
      .from('reschedule_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq('id', claimed.id)

    const row = enrollmentRow as unknown as
      | {
          id: string
          guest_name: string | null
          guest_email: string | null
          session: {
            id: string
            date: string
            start_time: string
            end_time: string
            class: { name: string } | Array<{ name: string }>
          } | null
        }
      | null

    const name = row?.guest_name ?? ''
    const email = row?.guest_email ?? ''
    const newSession = row?.session ?? null
    const className = Array.isArray(newSession?.class)
      ? newSession?.class[0]?.name
      : newSession?.class?.name
    if (email && newSession && className) {
      await sendEnrollmentConfirmation(email, {
        name,
        className,
        date: newSession.date,
        time: `${formatTime(newSession.start_time)} - ${formatTime(newSession.end_time)}`,
      }, { enrollmentId: row!.id }).catch((err) =>
        console.error('[RESCHEDULE_COMPLETE] Confirmation resend failed:', err)
      )

      await sendAdminAlert(
        'SaveYours — Reschedule completed',
        `<h2>Reschedule completed</h2>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;font-weight:bold;">Student:</td><td style="padding:8px;">${escapeHtml(name)} (${escapeHtml(email)})</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Class:</td><td style="padding:8px;">${escapeHtml(className)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">From session:</td><td style="padding:8px;">${escapeHtml(claimed.from_session_id)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">To session:</td><td style="padding:8px;">${escapeHtml(claimed.to_session_id)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">New date/time:</td><td style="padding:8px;">${escapeHtml(newSession.date)} ${escapeHtml(formatTime(newSession.start_time))}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Fee paid:</td><td style="padding:8px;">$${(Number(claimed.fee_amount) || 0).toFixed(2)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Payment Intent:</td><td style="padding:8px;">${escapeHtml(paymentIntentId ?? '')}</td></tr>
        </table>`
      ).catch((err) => console.error('[RESCHEDULE_COMPLETE] Admin reschedule alert failed:', err))
    }

    return { status: 'ok', newSessionId: claimed.to_session_id }
  }

  // Not-ok result from the DB function. Student has paid the fee but the
  // seat move couldn't happen — most commonly 'full' because another student
  // took the last target seat between the eligibility check and the DB
  // transaction. Flip to failed_full and alert admin; do NOT auto-refund.
  await supabase
    .from('reschedule_requests')
    .update({
      status: 'failed_full',
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq('id', claimed.id)

  console.warn('[RESCHEDULE_COMPLETE] RPC returned non-ok:', { rescheduleRequestId, rpcResult })

  await sendAdminAlert(
    'SaveYours — Reschedule paid but target unavailable',
    `<h2>Reschedule paid but target unavailable</h2>
    <p>A student paid the reschedule fee but the DB refused the move. <strong>Do not auto-refund</strong> — contact them to move to another date or issue a refund from the Stripe dashboard.</p>
    <table style="border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;">Reschedule request:</td><td style="padding:8px;">${escapeHtml(claimed.id)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Enrollment:</td><td style="padding:8px;">${escapeHtml(claimed.enrollment_id)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Target session:</td><td style="padding:8px;">${escapeHtml(claimed.to_session_id)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">RPC result:</td><td style="padding:8px;">${escapeHtml(String(rpcResult))}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Fee paid:</td><td style="padding:8px;">$${(Number(claimed.fee_amount) || 0).toFixed(2)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Payment Intent:</td><td style="padding:8px;">${escapeHtml(paymentIntentId ?? '')}</td></tr>
    </table>`
  ).catch((err) => console.error('[RESCHEDULE_COMPLETE] Admin fail alert failed:', err))

  return { status: 'rpc_failed', rpcResult: String(rpcResult ?? 'unknown'), paidButUnmoved: true }
}
