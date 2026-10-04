'use client'

import { useState } from 'react'

// Email-first entry point. The server endpoint returns {ok:true} regardless
// of whether an email exists, so this form always shows the same success
// message — never leak which emails have bookings.
export function RescheduleRequestLinkForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/reschedule/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website: '' }),
      })
      if (res.ok) {
        setStatus('sent')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded border border-green-400 bg-green-50 p-4 text-green-900">
        If we found a booking, we&rsquo;ve emailed you a link to reschedule. It expires in 7 days.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Reschedule link request">
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Email you booked with</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>
      <input type="text" name="website" value="" readOnly tabIndex={-1} aria-hidden="true" className="hidden" />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="bg-primary-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
      >
        {status === 'loading' ? 'Sending…' : 'Email me a reschedule link'}
      </button>
      {status === 'error' && (
        <p className="text-sm text-red-700">Something went wrong. Please try again in a moment.</p>
      )}
    </form>
  )
}
