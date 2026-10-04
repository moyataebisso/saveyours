import type { Metadata } from 'next';
import { REFUND_POLICY } from '@/lib/refund-policy';
import { LAST_UPDATED } from '@/lib/last-updated';

export const metadata: Metadata = {
  title: {
    absolute: 'Policies — Cancellation, Refunds & Terms | SaveYours',
  },
  description:
    'SaveYours cancellation and refund policy, plus terms and conditions for CPR, AED, BLS, and First Aid training in Bloomington, MN.',
  alternates: { canonical: '/policies' },
  openGraph: {
    url: '/policies',
    title: 'Policies — Cancellation, Refunds & Terms | SaveYours',
    description:
      'SaveYours cancellation and refund policy, plus terms and conditions for CPR, AED, BLS, and First Aid training in Bloomington, MN.',
  },
  twitter: {
    title: 'Policies — Cancellation, Refunds & Terms | SaveYours',
  },
};

export default function PoliciesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="container-custom py-12">
        <h1 className="text-4xl font-bold mb-2">Policies</h1>
        <p className="text-sm text-gray-500 mb-6">Last updated: {LAST_UPDATED}</p>

        {/* Policy summary callout — short enough to read without scrolling,
            keyed to the no-exceptions line at the bottom. Full numbered T&C
            still renders below so nothing is hidden; this just stops people
            from missing the 24h/50%-fee rule. */}
        <div className="mb-8 rounded-lg border-l-4 border-[#CC2936] bg-[#CC2936]/5 p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-[#1B2A4A] mb-3">
            At a glance
          </h2>
          <ul className="list-disc list-inside space-y-1 text-gray-800 text-sm sm:text-base">
            <li>
              Full refund within 24 hours of registration; after that, course fees are
              non-refundable.
            </li>
            <li>
              Reschedule at least 24 hours before class for a 50% fee — same class only —
              via the link in your confirmation email or at saveyours.net/reschedule.
            </li>
            <li>
              Requests inside 24 hours or no-shows forfeit the course fee.
            </li>
          </ul>
          <p className="mt-3 text-gray-900 text-sm sm:text-base">
            <strong><u>{REFUND_POLICY.noExceptionsLine}</u></strong>
          </p>
        </div>

        <div className="card p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Cancellation & Refund Policy</h2>

          <p className="text-gray-600 mb-4">{REFUND_POLICY.intro}</p>

          {REFUND_POLICY.sections.map((section) => (
            <div key={section.heading}>
              <h3 className="font-semibold text-lg mb-3">{section.heading}</h3>
              {section.bullets && (
                <ul className="list-disc list-inside space-y-2 text-gray-600 mb-6">
                  {section.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {section.paragraph && (
                <p className="text-gray-600 mb-6">{section.paragraph}</p>
              )}
              {section.heading === 'Rescheduling' && (
                <p className="text-gray-900 mb-6">
                  <strong><u>{REFUND_POLICY.noExceptionsLine}</u></strong>
                </p>
              )}
            </div>
          ))}

          <h3 className="font-semibold text-lg mb-3">Contact</h3>
          <p className="text-gray-600">
            For cancellations or rescheduling, please email{' '}
            <a href={`mailto:${REFUND_POLICY.contactEmail}`} className="text-primary-600 hover:underline">
              {REFUND_POLICY.contactEmail}
            </a>
            .
          </p>
        </div>

        <div className="card p-8">
          <h2 className="text-2xl font-bold mb-6">Terms & Conditions</h2>
          
          <p className="text-sm text-gray-500 mb-4">Last Updated: 10/04/2026</p>
          
          <p className="text-gray-600 mb-6">
            Welcome to SaveYours LLC. By registering for or participating in our CPR, AED, 
            and First Aid training courses, you agree to the following Terms & Conditions:
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">1. Services Provided</h3>
              <p className="text-gray-600">
                SaveYours LLC provides CPR, AED, and First Aid training courses for individuals 
                and groups. Our courses are intended for educational purposes only. Completion 
                of training does not grant medical licensure or authorization to practice medicine.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">2. Registration & Payment</h3>
              <p className="text-gray-600">
                Full payment is required at the time of registration to secure your spot in a 
                course. You are responsible for ensuring that the contact information you provide 
                is accurate so we can communicate important updates.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">3. Training Materials</h3>
              <p className="text-gray-600">
                Any training manuals or materials provided are for personal use only and may not 
                be copied, distributed, or reproduced without prior written permission.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">4. Rescheduling</h3>
              <p className="text-gray-600">
                You may reschedule your class online using the link in your confirmation email, at
                saveyours.net/reschedule, or by emailing info@saveyours.net. Rescheduling requests must
                be made at least 24 hours before your scheduled class and are subject to a rescheduling
                fee of half (50%) of your original purchase. Classes may only be rescheduled to another
                date of the same class. Requests made less than 24 hours before the class, or failure to
                attend without notice (&ldquo;no-show&rdquo;), will result in forfeiture of the course fee.{' '}
                <strong><u>There will be no exceptions made to the rescheduling and refund policy.</u></strong>
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">5. Liability Disclaimer</h3>
              <p className="text-gray-600">
                SaveYours LLC makes every effort to provide accurate, effective, and safe instruction.
                However, we are not responsible for how participants apply the training outside of class.
                By attending a course, you acknowledge and agree that SaveYours LLC, its instructors,
                and affiliates are not liable for any injury, loss, or damages that may occur during
                or after training.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">6. Health & Safety</h3>
              <p className="text-gray-600">
                If you have any medical conditions or physical limitations, it is your responsibility
                to consult with a physician before participating. You agree to inform the instructor
                of any limitations that may affect your participation.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">7. Modifications to Terms</h3>
              <p className="text-gray-600">
                SaveYours LLC reserves the right to update or modify these Terms & Conditions at any
                time. The most current version will always be posted on our website.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">8. Governing Law</h3>
              <p className="text-gray-600">
                These Terms & Conditions are governed by the laws of the State of Minnesota. Any
                disputes shall be resolved in the courts of Minnesota.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}