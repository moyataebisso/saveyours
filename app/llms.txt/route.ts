import { CLASS_INFO } from '@/lib/class-info';

// Served at /llms.txt as a plain-text route so the class list stays generated
// from lib/class-info.ts and can't drift from the pricing/audience shown on
// the site. Body is a static string built at request time; safe to hit
// often (no DB access).

const SITE = 'https://www.saveyours.net';

function buildBody(): string {
  const classesBlock = CLASS_INFO.map(
    c =>
      `- ${c.displayName} — $${c.price}, for ${c.audience.toLowerCase()}: ${SITE}/classes/${c.slug}`
  ).join('\n');

  return `# SaveYours LLC

SaveYours is a Red Cross authorized training provider based in Bloomington, MN. We teach CPR, AED, BLS, and First Aid to individuals and small groups, with on-site group training available across the Twin Cities metro.

## Format

Classes are blended: students complete the Red Cross online portion first, bring proof of completion to the in-person session, and finish with a hands-on skills check. Class size is capped at 12 students to keep every student on the manikins.

## Certification

Certifications are valid for two years from the date of the in-person class. Students should register for a refresher class before their certification expires.

## Location and service area

Administrative address: 10800 Lyndale Ave S Suite 310, Bloomington, MN 55420. On-site group training is offered throughout the Twin Cities metro and greater Minnesota.

## Cancellations

Full cancellation and refund terms are on /policies/refunds. In short: a full refund is available if you notify us within 24 hours of registration; after that, course fees are non-refundable. Rescheduling is free with at least 24 hours notice before class; no-shows forfeit the course fee.

## Classes

${classesBlock}

## Links

- Class schedule and registration: ${SITE}/classes
- Frequently asked questions: ${SITE}/faq
- Cancellation and refund policy: ${SITE}/policies/refunds
- Contact: info@saveyours.net
`;
}

export function GET() {
  return new Response(buildBody(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
