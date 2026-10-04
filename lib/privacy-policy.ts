// Single source of truth for /privacy. Two placeholders you'll fill in
// later — RETENTION_PERIOD and DELETION_CONTACT_EMAIL — are defined as
// module-level constants at the top of this file so they're trivial to
// locate and change. Both have sensible defaults so the page ships now.

// PLACEHOLDER — RETENTION_PERIOD: how long we retain enrollment and
// certification records after a card expires. Default: two years past
// expiry (i.e., four years total, since Red Cross cards are 2-year).
// Meea: change this string when you settle on a policy.
//
// Reads as "...for ${RETENTION_PERIOD} after your certification expires" in
// the Retention paragraph below, so the value is just the duration — do not
// re-include the words "after your certification expires".
export const RETENTION_PERIOD = 'two years'

// PLACEHOLDER — DELETION_CONTACT_EMAIL: where deletion and access
// requests are directed. Default: info@saveyours.net. Meea: change if a
// dedicated privacy inbox is set up.
export const DELETION_CONTACT_EMAIL = 'info@saveyours.net'

// Effective date shown at the top of the policy. Update when the copy
// materially changes.
export const PRIVACY_EFFECTIVE_DATE = 'October 4, 2026'

export interface PrivacySection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export const PRIVACY_POLICY: {
  effectiveDate: string
  intro: string
  sections: PrivacySection[]
  contactBlock: string[]
} = {
  effectiveDate: PRIVACY_EFFECTIVE_DATE,
  intro:
    'SaveYours LLC provides CPR, BLS, and first aid training in Minnesota. This policy explains what information we collect when you register for a class or contact us, and what we do with it.',
  sections: [
    {
      heading: 'What we collect',
      paragraphs: [
        'When you register for a class: your name, email address, phone number, and the details of the class you\'re registering for.',
        'When you contact us: your name, email address, phone number, and whatever you tell us in your message.',
        'When you pay: your payment is processed by Stripe. Card numbers never touch our systems and we do not store them. We receive only a confirmation that payment succeeded and the amount.',
        'When you visit our site, our hosting provider collects basic page analytics (which pages are viewed and roughly where visitors came from). This helps us understand what people are looking for.',
      ],
    },
    {
      heading: 'Why we collect it',
      bullets: [
        'To register you for the class you selected',
        'To send your confirmation and your online course instructions',
        'To issue your certification',
        'To answer your questions when you contact us',
      ],
    },
    {
      heading: `What we don't do`,
      paragraphs: [
        'We do not sell your personal information. We do not share it with advertisers. We do not use it for anything other than running our classes and communicating with you about them.',
      ],
    },
    {
      heading: 'Who else handles your information',
      paragraphs: [
        'We use a small number of service providers to operate:',
      ],
      bullets: [
        'Stripe — payment processing',
        'Supabase — database hosting',
        'Vercel — website hosting and basic page analytics',
        'Google Workspace (Gmail) — email delivery for confirmations and notifications',
      ],
    },
    {
      heading: 'How long we keep it',
      paragraphs: [
        `We keep your registration and certification records for ${RETENTION_PERIOD} after your certification expires, so we can verify your training history and issue replacement cards if you need one. After that, records are deleted.`,
      ],
    },
    {
      heading: 'Your choices',
      paragraphs: [
        `You can ask us what information we have about you, correct it if it's wrong, or ask us to delete it. Email ${DELETION_CONTACT_EMAIL} and we'll respond within 30 days.`,
        `If you ask us to delete your information, we may need to keep a minimal record of your certification for as long as it's valid, since that's what lets us verify your training if an employer asks.`,
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        `Our classes and this website are intended for adults. We don't knowingly collect information from anyone under 13.`,
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        `If we update this policy, we'll change the effective date at the top.`,
      ],
    },
  ],
  contactBlock: [
    'SaveYours LLC',
    '10800 Lyndale Ave S, Suite 310',
    'Bloomington, MN 55420',
    'info@saveyours.net',
  ],
}
