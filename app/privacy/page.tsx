import type { Metadata } from 'next';
import { PRIVACY_POLICY } from '@/lib/privacy-policy';

export const metadata: Metadata = {
  title: 'Privacy Policy — SaveYours',
  description:
    'How SaveYours LLC collects, uses, and protects information from students who register for CPR, BLS, and First Aid classes.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="container-custom py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 mb-6 sm:mb-8">
            Effective {PRIVACY_POLICY.effectiveDate}
          </p>

          <div className="card p-6 sm:p-8 space-y-6 sm:space-y-8">
            <p className="text-gray-700 leading-relaxed">{PRIVACY_POLICY.intro}</p>

            {PRIVACY_POLICY.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg sm:text-xl font-bold text-[#1B2A4A] mb-3">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((p, idx) => (
                  <p
                    key={idx}
                    className="text-gray-700 leading-relaxed mb-3 last:mb-0"
                  >
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="list-disc list-inside space-y-1.5 text-gray-700 mt-3">
                    {section.bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section>
              <h2 className="text-lg sm:text-xl font-bold text-[#1B2A4A] mb-3">
                Contact
              </h2>
              <address className="not-italic text-gray-700 leading-relaxed">
                {PRIVACY_POLICY.contactBlock.map((line, idx) =>
                  line.includes('@') ? (
                    <span key={idx}>
                      <a
                        href={`mailto:${line}`}
                        className="text-[#CC2936] underline hover:opacity-80"
                      >
                        {line}
                      </a>
                      <br />
                    </span>
                  ) : (
                    <span key={idx}>
                      {line}
                      <br />
                    </span>
                  )
                )}
              </address>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
