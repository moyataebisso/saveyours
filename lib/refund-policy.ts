// Single source of truth for the refund/cancellation/rescheduling policy.
// Consumers: /policies (combined page), /policies/refunds (dedicated page),
// and the scrollable box in /cart above the agreement checkbox. Any edit
// here propagates to every surface — no drift possible.

export interface RefundPolicySection {
  heading: string
  paragraph?: string
  bullets?: string[]
}

export const REFUND_POLICY: {
  intro: string
  sections: RefundPolicySection[]
  contactEmail: string
  // One-sentence compression of the two Cancellations bullets. Correct in
  // matter-of-fact contexts (policy summaries, receipts). Do NOT use it at
  // moments of hesitation — "non-refundable" is the harshest possible
  // framing there. Kept next to the full policy so it can't drift.
  oneSentence: string
  // Reassurance framing for moments when the shopper is hesitating (the
  // exit-intent modal on /cart). Uses the rescheduling angle rather than
  // the refund cliff — same underlying policy, softer angle. As of
  // 2026-10-04, rescheduling is a paid 50% fee (not free) — the sentence
  // sells flexibility, not the fee itself.
  reassuranceSentence: string
} = {
  intro:
    'At SaveYours LLC, we value your commitment to learning lifesaving skills. To ensure fairness and accommodate all participants, we have the following cancellation and rescheduling policy:',
  oneSentence:
    'A full refund is available within 24 hours of registration; after that, course fees are non-refundable.',
  reassuranceSentence:
    'Plans change — you can reschedule to another date of the same class, up to 24 hours before class, for a 50% fee.',
  sections: [
    {
      heading: 'Cancellations',
      bullets: [
        'A full refund will be issued if you notify us within 24 hours of registration.',
        'After 24 hours, course fees are non-refundable.',
      ],
    },
    {
      heading: 'Rescheduling',
      bullets: [
        'You may reschedule your class online using the link in your confirmation email, at saveyours.net/reschedule, or by emailing info@saveyours.net.',
        'Rescheduling requests must be made at least 24 hours before your scheduled class and are subject to a rescheduling fee of half (50%) of your original purchase.',
        'Classes may only be rescheduled to another date of the same class.',
        'Requests made less than 24 hours before the class, or failure to attend without notice (no-show), will result in forfeiture of the course fee.',
        'There will be no exceptions made to the rescheduling and refund policy.',
      ],
    },
    {
      heading: 'Attendance Policy',
      paragraph:
        'Students must arrive ON-TIME for their scheduled in-person session. Failure to show up within 15 minutes of the scheduled in-person session will result in the forfeiture of your position in that class and your course fee.',
    },
  ],
  contactEmail: 'info@saveyours.net',
}
