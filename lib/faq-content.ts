// Single source of truth for /faq. Categories rendered in order; the first
// item in each category opens by default. Refund and blended answers are
// composed at module load from the authoritative constants so this file
// can't drift from lib/refund-policy.ts or lib/blended-copy.ts.
//
// [CONFIRM] markers indicate answers Meea has been asked to tighten later.
// They are written generically so the page can ship immediately.

import { REFUND_POLICY } from './refund-policy'
import { BLENDED_EXPLAINER_SENTENCES } from './blended-copy'

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqCategory {
  title: string
  items: FaqItem[]
}

const refundCancellationBullets = REFUND_POLICY.sections.find(
  (s) => s.heading === 'Cancellations'
)?.bullets ?? []
const rescheduleBullets = REFUND_POLICY.sections.find(
  (s) => s.heading === 'Rescheduling'
)?.bullets ?? []

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: 'Getting Started',
    items: [
      {
        question: `What's the difference between BLS and CPR/AED/First Aid?`,
        answer:
          `BLS (Basic Life Support) is for healthcare professionals — nurses, CNAs, medical assistants, EMS, and anyone whose license or employer requires it. ` +
          `CPR/AED/First Aid is for everyone else: teachers, childcare providers, coaches, personal trainers, workplace responders, and anyone who wants to be ready. ` +
          `If your employer or licensing board told you which one you need, go with that. ` +
          `Not sure? Email info@saveyours.net and tell us your job — that's usually enough for us to point you to the right class.`,
      },
      {
        question: 'How much do classes cost?',
        answer:
          `BLS is $75. CPR/AED/First Aid is $100. Mobile training for groups is quoted based on group size and location — request a quote through our contact page.`,
      },
      {
        question: 'Are your certifications accepted by employers and licensing boards?',
        answer:
          `Yes. SaveYours is a certified Red Cross training provider, and our classes meet national, state, licensing, and OSHA requirements.`,
      },
      {
        question: 'How long is my certification good for?',
        answer:
          `Two years from the date you complete your class. We'll email you a reminder before it expires.`,
      },
    ],
  },
  {
    title: 'Blended Classes',
    items: [
      {
        question: `What does "blended" mean?`,
        answer:
          `Blended means the course has two parts: an online portion you complete on your own beforehand, and an in-person skills session where you practice and get checked off. ` +
          `Both are required — you can't certify with only one.`,
      },
      {
        question: 'Do I have to finish the online part before class?',
        answer:
          `Yes, and it's the thing people most often miss. ${BLENDED_EXPLAINER_SENTENCES[0]} ` +
          `Bring proof — print your completion record or have it ready on your phone. Without it we can't certify you that day.`,
      },
      {
        question: 'When do I get the online course link?',
        answer:
          `${BLENDED_EXPLAINER_SENTENCES[1]} If it hasn't arrived, check your spam folder, then email info@saveyours.net.`,
      },
      {
        question: `What if I haven't finished the online part in time?`,
        answer:
          `Contact us as soon as you know — info@saveyours.net. ` +
          `We'd much rather move you to another date than have you show up unable to certify. Standard rescheduling terms apply.`,
      },
    ],
  },
  {
    title: 'The Day of Class',
    items: [
      {
        question: 'What should I bring?',
        answer:
          `Proof of online course completion — printed or on your device — and comfortable clothes you can move in. ` +
          `You'll be kneeling on the floor to practice compressions.`,
      },
      {
        question: `What if I'm running late?`,
        answer:
          `There's a 15-minute grace period. After that we may not be able to complete your certification that day, and standard rescheduling terms apply.`,
      },
      {
        question: 'How many people are in a class?',
        answer:
          `Twelve students maximum. Small classes mean real hands-on time with an instructor instead of waiting your turn.`,
      },
      {
        question: 'Do I have to physically perform CPR to pass?',
        answer:
          `Yes. Certification requires demonstrating the skills, including chest compressions on a training mannequin, which means kneeling on the floor. ` +
          `If you have a physical limitation, contact us before registering and we'll talk through options.`,
      },
    ],
  },
  {
    title: 'After Class',
    items: [
      {
        question: 'When do I get my certification card?',
        answer:
          `Your Red Cross certification is issued after you complete the in-person skills session. ` +
          `If you haven't received it when you expected to, email info@saveyours.net and we'll track it down.`,
      },
      {
        question: 'What if I lose my card?',
        answer: `Email info@saveyours.net and we'll help you get a replacement.`,
      },
      {
        question: 'How do I renew?',
        answer:
          `Register for the same class again before your two years are up. We'll send a reminder as your expiration approaches.`,
      },
    ],
  },
  {
    title: 'Groups and On-Site Training',
    items: [
      {
        question: 'Do you come to us?',
        answer:
          `Yes. Mobile training brings the class to your workplace, clinic, school, or facility — useful when you're certifying a whole team at once. ` +
          `Pricing depends on group size and location. Request a quote through our contact page.`,
      },
      {
        question: 'How many people do we need for on-site training?',
        answer:
          `It depends on your group and location. Send us the details through our contact page and we'll put together a quote.`,
      },
      {
        question: 'Can you invoice our organization?',
        answer:
          `Get in touch through our contact page and we'll work out the details for your organization.`,
      },
    ],
  },
  {
    title: 'Registration and Payment',
    items: [
      {
        question: 'How do I register?',
        answer:
          `Browse classes on our website, pick a date and time, and complete registration and payment online. ` +
          `You'll get a confirmation email right away and the online course instructions within 24 hours.`,
      },
      {
        question: 'Can I cancel or get a refund?',
        // Composed from REFUND_POLICY so editing that constant updates this
        // answer automatically. Bullets are joined into a natural paragraph.
        answer: [
          ...refundCancellationBullets,
          ...rescheduleBullets,
        ].join(' '),
      },
      {
        question: 'Can I switch to a different date?',
        answer:
          `Yes, free of charge, if you email info@saveyours.net at least 24 hours before your scheduled class.`,
      },
      {
        question: 'Can I register more than one person?',
        answer:
          `Yes. For a few people, register each separately. For a larger group, contact us — mobile training may be a better fit.`,
      },
    ],
  },
]

export const FAQ_STILL_HAVE_QUESTIONS =
  `Email info@saveyours.net. If you're not sure which class you need, just tell us your job or what your employer is asking for.`
