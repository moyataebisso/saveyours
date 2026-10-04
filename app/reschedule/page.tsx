import type { Metadata } from 'next'
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
          <RescheduleRequestLinkForm />
          <p className="text-sm text-gray-600 mt-6">
            You may reschedule to another date in the same class by paying a fee of 50% of your
            original purchase. Rescheduling is not available within 24 hours of your class start time.
          </p>
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
