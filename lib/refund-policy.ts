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
  // the refund cliff — same underlying policy, softer angle.
  reassuranceSentence: string
} = {
  intro:
    'At SaveYours LLC, we value your commitment to learning lifesaving skills. To ensure fairness and accommodate all participants, we have the following cancellation and rescheduling policy:',
  oneSentence:
    'A full refund is available within 24 hours of registration; after that, course fees are non-refundable.',
  reassuranceSentence:
    'Plans change — you can reschedule free with 24 hours notice.',
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
        'If you are unable to attend your scheduled class, you may reschedule at no additional cost, provided you email us at info@saveyours.net.',
        'Rescheduling requests must be submitted at least 24 hours before your scheduled class.',
        'Requests made less than 24 hours before the class, or failure to attend without notice (no-show), will result in forfeiture of your course fee.',
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
