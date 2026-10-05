import type { Metadata } from 'next'
import Link from 'next/link'
import { verifyRescheduleToken } from '@/lib/reschedule'
import { RescheduleRequestLinkForm } from './request-link-form'
import { ReschedulePickerClient } from './picker-client'
import { loadReschedulePickerData } from './load-picker-data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'Reschedule — SaveYours' },
  description: 'Move your SaveYours class to a different date.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/reschedule' },
}

type Params = { token?: string }

export default async function ReschedulePage({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const sp = await searchParams
  const rawToken = typeof sp.token === 'string' ? sp.token : undefined

  // No token: show the "email me a link" form. We don't require login — the
  // link in the email IS the auth, HMAC-signed and short-lived.
  if (!rawToken) {
    return (
      <main className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-bold mb-2">Reschedule your class</h1>
          <p className="text-gray-700 mb-6">
            Enter the email you booked with. If we find a matching upcoming class we&rsquo;ll email you a
            link to pick a new date.
          </p>

          {/* Policy points — the same three bullets shown on the homepage
              callout and the T&C. Rendered ABOVE the form so a student sees
              the rules before they type their email. Keep this card compact;
              the full policy sits one click away via the link below. */}
          <section
            className="mb-6 rounded-lg border border-gray-200 bg-white p-5 sm:p-6"
            aria-label="Reschedule policy summary"
          >
            <h2 className="text-base sm:text-lg font-semibold text-[#1B2A4A] mb-3">
              Before you reschedule
            </h2>
            <ul className="space-y-2 text-gray-800 text-sm sm:text-base">
              <li className="flex items-start gap-2">
                <span className="text-primary-600 mt-0.5" aria-hidden="true">•</span>
                <span>At least 24 hours before your class</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-600 mt-0.5" aria-hidden="true">•</span>
                <span>50% rescheduling fee of your original purchase</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-600 mt-0.5" aria-hidden="true">•</span>
                <span>Move to another date of the same class</span>
              </li>
            </ul>
            <p className="mt-3 text-sm">
              <Link href="/policies" className="text-primary-600 hover:underline">
                View full policy
              </Link>
            </p>
          </section>

          <RescheduleRequestLinkForm />
        </div>
      </main>
    )
  }

  const verifyResult = verifyRescheduleToken(rawToken)
  if (verifyResult.ok !== true) {
    const reason = (verifyResult as { reason?: string }).reason
    return (
      <main className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-bold mb-2">Reschedule link invalid</h1>
          <p className="text-gray-700 mb-4">
            {reason === 'expired'
              ? 'That link has expired. Request a new one by entering your email below.'
              : 'That link is not valid. Request a new one by entering your email below.'}
          </p>
          <RescheduleRequestLinkForm />
        </div>
      </main>
    )
  }

  const data = await loadReschedulePickerData(verifyResult.enrollmentId)
  return <ReschedulePickerClient {...data} />
}
