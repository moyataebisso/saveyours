// Shared copy about the blended-class online portion. Used by
// lib/email.ts (confirmation email), /classes (pre-purchase explainer),
// and /cart (per-item line). Editing here updates every surface — the
// pre-purchase warning and the post-purchase email cannot drift apart.

// Confirmation-email framing. "This course" refers to the specific class the
// student just registered for, so this wording is only correct post-purchase.
export const BLENDED_EXPLAINER_SENTENCES = [
  'This course requires online learning to be completed BEFORE the classroom portion.',
  'You will receive a separate email within 24 hours with instructions to access the online course.',
] as const

// Listing-page framing. Same meaning, but talks about "Classes marked
// Blended" because the user is browsing multiple classes and there's no
// specific "this course" referent yet.
export const BLENDED_LISTING_SENTENCES = [
  'Classes marked Blended require online learning to be completed BEFORE the classroom portion.',
  "You'll receive a separate email within 24 hours with instructions to access the online course.",
] as const

export const BLENDED_CART_LINE = 'Includes a required online portion before class.'

// Type-safe check for whether a class has an online portion. The DB may
// deliver duration_online as null even though the TS type says number,
// and 0 must be treated identically to null (in-person, no online portion).
export function isBlendedClass(cls: { duration_online?: number | null } | null | undefined): boolean {
  if (!cls) return false
  const d = cls.duration_online
  return typeof d === 'number' && d > 0
}
