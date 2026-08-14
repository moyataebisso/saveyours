import type { Metadata } from 'next';
import Link from 'next/link';
import { FAQ_CATEGORIES, FAQ_STILL_HAVE_QUESTIONS } from '@/lib/faq-content';

export const metadata: Metadata = {
  title: 'FAQ — SaveYours CPR & First Aid Training',
  description:
    'Answers to common questions about our BLS, CPR/AED/First Aid, and mobile training classes — pricing, blended-course logistics, refunds, and certification.',
};

// FAQPage schema for search engines. Every question and answer is included
// so long-tail queries ("how long is CPR certification good for") can pull
// answers directly into search results.
function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_CATEGORIES.flatMap((category) =>
      category.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      }))
    ),
  };
}

export default function FaqPage() {
  const jsonLd = buildFaqJsonLd();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="bg-white border-b">
        <div className="container-custom py-8 sm:py-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Frequently Asked Questions
          </h1>
          <p className="text-gray-600 max-w-2xl">
            The quick answers to what people ask most before signing up. If you
            don&rsquo;t see your question, email{' '}
            <a
              href="mailto:info@saveyours.net"
              className="text-[#CC2936] underline hover:opacity-80"
            >
              info@saveyours.net
            </a>
            .
          </p>
        </div>
      </section>

      <section className="container-custom py-8 sm:py-12">
        <div className="max-w-3xl mx-auto space-y-8 sm:space-y-10">
          {FAQ_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1B2A4A] mb-3 sm:mb-4">
                {category.title}
              </h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200 overflow-hidden">
                {category.items.map((item, idx) => (
                  <details
                    key={item.question}
                    open={idx === 0}
                    className="group"
                  >
                    <summary className="flex items-start justify-between gap-4 cursor-pointer p-4 sm:p-5 list-none hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2A4A]">
                      <span className="font-medium text-gray-900 text-sm sm:text-base">
                        {item.question}
                      </span>
                      <span
                        aria-hidden="true"
                        className="flex-shrink-0 mt-0.5 text-[#1B2A4A] text-lg leading-none transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-[#1B2A4A]/5 border border-[#1B2A4A]/20 rounded-lg p-5 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-[#1B2A4A] mb-2">
              Still have questions?
            </h2>
            <p className="text-gray-700 mb-4 text-sm sm:text-base">
              {FAQ_STILL_HAVE_QUESTIONS}
            </p>
            <Link
              href="/contact"
              className="inline-block bg-[#CC2936] text-white font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 text-sm sm:text-base"
            >
              Contact us
            </Link>
          </div>

          <p className="text-center text-xs text-gray-500">
            SaveYours LLC · 10800 Lyndale Ave S, Suite 310 · Bloomington, MN 55420
          </p>
        </div>
      </section>
    </div>
  );
}
