import type { Metadata } from 'next'
import { completeReschedule } from '@/lib/reschedule-complete'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'Reschedule complete — SaveYours' },
  robots: { index: false, follow: false },
  alternates: { canonical: '/reschedule/success' },
}

function formatTime(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function formatHuman(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

type SearchParams = { session_id?: string }

async function loadNewSessionDetails(toSessionId: string) {
  const { data } = await supabaseAdmin
    .from('class_sessions')
    .select('id, date, start_time, end_time, class:classes(name)')
    .eq('id', toSessionId)
    .maybeSingle()
  if (!data) return null
  const classField = Array.isArray((data as unknown as { class?: unknown }).class)
    ? ((data as unknown as { class: Array<{ name: string }> }).class[0])
    : ((data as unknown as { class?: { name: string } | null }).class ?? null)
  return {
    date: data.date as string,
    start_time: data.start_time as string,
    end_time: data.end_time as string,
    className: classField?.name ?? 'your class',
  }
}

export default async function RescheduleSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const checkoutSessionId = typeof sp.session_id === 'string' ? sp.session_id : null

  if (!checkoutSessionId) {
    return (
      <main className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-700">
            We&rsquo;re missing the Stripe session id. If you just paid for a reschedule, email
            info@saveyours.net and we&rsquo;ll fix it manually.
          </p>
        </div>
      </main>
    )
  }

  // Fire the idempotent completion. The Stripe webhook runs the same function
  // when checkout.session.completed arrives — whichever lands first wins the
  // atomic claim; the second call returns `already_processed`.
  const outcome = await completeReschedule(checkoutSessionId).catch((err) => {
    console.error('[RESCHEDULE_SUCCESS] completeReschedule threw:', err)
    return null
  })

  if (!outcome) {
    return (
      <main className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-bold mb-2">We&rsquo;re finishing your reschedule</h1>
          <p className="text-gray-700">
            Your payment went through. We hit a snag completing the move — we&rsquo;ve been notified and
            will email you shortly.
          </p>
        </div>
      </main>
    )
  }

  if (outcome.status === 'not_paid') {
    return (
      <main className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-bold mb-2">Payment not completed</h1>
          <p className="text-gray-700">We don&rsquo;t show a completed payment yet. Please try again.</p>
        </div>
      </main>
    )
  }

  if (outcome.status === 'rpc_failed') {
    return (
      <main className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-bold mb-2">That class filled up as you paid</h1>
          <p className="text-gray-700 mb-4">
            We&rsquo;ve been notified and will contact you within 24 hours to move you to another date or
            refund you.
          </p>
          <p className="text-gray-700">
            Questions? Email{' '}
            <a href="mailto:info@saveyours.net" className="text-primary-600 underline">
              info@saveyours.net
            </a>
            .
          </p>
        </div>
      </main>
    )
  }

  if (outcome.status === 'not_found') {
    return (
      <main className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-700">We couldn&rsquo;t find your reschedule request. Email info@saveyours.net.</p>
        </div>
      </main>
    )
  }

  // ok or already_processed: both mean "the move has happened". Pull the
  // target session details so we can show the student their new date.
  let newSessionId: string | null = null
  if (outcome.status === 'ok') {
    newSessionId = outcome.newSessionId
  } else {
    // already_processed: fetch the saved target id from the reschedule_requests
    // row keyed by the Stripe session id.
    const { data } = await supabaseAdmin
      .from('reschedule_requests')
      .select('to_session_id')
      .eq('stripe_checkout_session_id', checkoutSessionId)
      .maybeSingle()
    newSessionId = data?.to_session_id ?? null
  }

  const details = newSessionId ? await loadNewSessionDetails(newSessionId) : null

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto max-w-2xl px-4">
        <h1 className="text-3xl font-bold mb-2">You&rsquo;re rescheduled</h1>
        <p className="text-gray-700 mb-6">
          Your fee is paid and your seat is reserved for the new date. We&rsquo;ve emailed a fresh
          confirmation.
        </p>
        {details && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">{details.className}</h2>
            <p className="text-gray-900">{formatHuman(details.date)}</p>
            <p className="text-gray-700">
              {formatTime(details.start_time)} – {formatTime(details.end_time)}
            </p>
          </div>
        )}
        <p className="text-sm text-gray-600 mt-6">
          Questions?{' '}
          <a href="mailto:info@saveyours.net" className="text-primary-600 underline">
            info@saveyours.net
          </a>
        </p>
      </div>
    </main>
  )
}
