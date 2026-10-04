// Shared helpers for the capacity model.
//
// The DB trigger `trg_enforce_session_capacity` raises an exception whose
// message starts with "SESSION_FULL" when a seat would push a session past
// `max_capacity`. Supabase surfaces this via `error.message`, so every
// enrollment insert/update that can hit the trigger needs to recognise it.
//
// Seat accounting rule: a seat is an enrollment row with status <> 'cancelled'.
// The denormalised `class_sessions.current_enrollment` counter is maintained
// by application code and MAY drift under concurrent writes (that's exactly
// what caused the 10/03 13-in-a-12 overbook). The authoritative count is
// `COUNT(*) FROM enrollments WHERE session_id = $1 AND status <> 'cancelled'`.

export const SESSION_FULL_PREFIX = 'SESSION_FULL'

// True when an error raised by a Supabase insert/update looks like the DB
// capacity trigger refusing to seat the row. The Postgres message is wrapped
// by PostgREST into `error.message` so a prefix match is enough.
export function isSessionFullError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const msg = (err as { message?: unknown }).message
  return typeof msg === 'string' && msg.includes(SESSION_FULL_PREFIX)
}

// Pure "spots left" calculation. Used for display and for the pre-payment
// gate inside create-intent — the gate feeds this the real row count, not
// the counter, so a drifted counter can never let the gate pass when the
// class is actually full.
export function spotsLeft(maxCapacity: number, seatsTaken: number): number {
  if (!Number.isFinite(maxCapacity) || !Number.isFinite(seatsTaken)) return 0
  return Math.max(0, maxCapacity - seatsTaken)
}

// True when adding one more seat would exceed capacity. Mirrors spotsLeft so
// the UI and the server use the same predicate.
export function isSessionFull(maxCapacity: number, seatsTaken: number): boolean {
  return spotsLeft(maxCapacity, seatsTaken) <= 0
}
