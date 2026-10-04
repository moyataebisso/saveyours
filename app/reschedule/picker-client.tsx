'use client'

import { useState } from 'react'
import type { PickerData } from './load-picker-data'

// Shared formatter mirrors app/api/enrollment/create/route.ts. Called ONCE
// per rendered time string — the double-format incident from commit 035ffd9
// was caused by callers pre-formatting and then calling into a template
// that formatted again. Here we own the whole render.
function formatTime(time: string): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function formatHuman(dateIso: string): string {
  // dateIso is YYYY-MM-DD. new Date('YYYY-MM-DD') would parse as UTC midnight
  // (day-shift bug). Appending T00:00:00 pins it to local midnight for the
  // display render, which is fine for US clients.
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ReschedulePickerClient(props: PickerData) {
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (props.ok !== true) {
    const message = (props as { message?: string }).message ?? 'This class can no longer be rescheduled online.'
    return (
      <main className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-bold mb-2">We can&rsquo;t reschedule this class</h1>
          <p className="text-gray-700 mb-6">{message}</p>
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

  const { enrollmentId, className, from, feeCents, policyText, targets } = props

  async function startCheckout(toSessionId: string, token: string) {
    setError(null)
    setSubmitting(toSessionId)
    try {
      const res = await fetch('/api/reschedule/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, toSessionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.url) {
        setError(data?.error || 'Could not start checkout. Please try again.')
        setSubmitting(null)
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('[RESCHEDULE] startCheckout threw:', err)
      setError('Could not start checkout. Please try again.')
      setSubmitting(null)
    }
  }

  // The token is in the current URL; we don't want to re-sign on the client,
  // just reuse what the server already verified for display. The checkout
  // POST will re-verify it server-side.
  const token =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('token') || ''
      : ''

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-bold mb-2">Reschedule your class</h1>
        <p className="text-gray-700 mb-6">{policyText}</p>

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Current class</h2>
          <p className="text-gray-900">
            <strong>{className}</strong>
          </p>
          <p className="text-gray-700">
            {formatHuman(from.date)} · {formatTime(from.start_time)} – {formatTime(from.end_time)}
          </p>
          <p className="mt-4 text-gray-900">
            Reschedule fee:{' '}
            <strong>${(feeCents / 100).toFixed(2)}</strong>
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Pick a new date</h2>

          {targets.length === 0 ? (
            <p className="text-gray-700">
              There are no other eligible dates for <strong>{className}</strong> right now. Email{' '}
              <a href="mailto:info@saveyours.net" className="text-primary-600 underline">
                info@saveyours.net
              </a>{' '}
              and we&rsquo;ll help you find one.
            </p>
          ) : (
            <ul className="space-y-3">
              {targets.map((t) => {
                const spotsLeft = Math.max(0, t.max_capacity - t.seats_taken)
                return (
                  <li
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded border border-gray-200 p-4"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {formatHuman(t.date)}
                      </p>
                      <p className="text-sm text-gray-700">
                        {formatTime(t.start_time)} – {formatTime(t.end_time)} ·{' '}
                        {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={submitting !== null}
                      onClick={() => startCheckout(t.id, token)}
                      className="shrink-0 bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
                      aria-label={`Pay fee and move to ${formatHuman(t.date)}`}
                    >
                      {submitting === t.id
                        ? 'Starting checkout…'
                        : `Pay $${(feeCents / 100).toFixed(2)} and move to this date`}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        </section>

        <p className="text-sm text-gray-600 mt-6">
          Enrollment id: <code>{enrollmentId.slice(0, 8)}…</code>
        </p>
      </div>
    </main>
  )
}
