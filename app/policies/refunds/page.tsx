import Link from 'next/link';
import { REFUND_POLICY } from '@/lib/refund-policy';

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="container-custom py-8 sm:py-12">
        <div className="mb-6">
          <Link
            href="/policies"
            className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-2"
          >
            &larr; All policies
          </Link>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8">Cancellation &amp; Refund Policy</h1>

        <div className="card p-6 sm:p-8">
          <p className="text-gray-700 mb-6">{REFUND_POLICY.intro}</p>

          {REFUND_POLICY.sections.map((section) => (
            <div key={section.heading} className="mb-6 last:mb-0">
              <h2 className="font-semibold text-lg mb-3">{section.heading}</h2>
              {section.bullets && (
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  {section.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {section.paragraph && <p className="text-gray-700">{section.paragraph}</p>}
            </div>
          ))}

          <h2 className="font-semibold text-lg mb-3 mt-8">Contact</h2>
          <p className="text-gray-700">
            For cancellations or rescheduling, please email{' '}
            <a
              href={`mailto:${REFUND_POLICY.contactEmail}`}
              className="text-[#CC2936] hover:underline"
            >
              {REFUND_POLICY.contactEmail}
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
