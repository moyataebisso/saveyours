import { describe, it, expect, beforeAll } from 'vitest'

// Set the signing secret BEFORE importing the module under test — the module
// loads env on each call, but we want its tests to be deterministic even if
// another test suite has already pulled in /lib via a transitive import.
process.env.RESCHEDULE_TOKEN_SECRET =
  process.env.RESCHEDULE_TOKEN_SECRET ||
  'test-reschedule-secret-at-least-32-chars-long-abc'

import {
  classStartUtc,
  rescheduleFee,
  checkEligibility,
  signRescheduleToken,
  verifyRescheduleToken,
  RESCHEDULE_POLICY,
} from '@/lib/reschedule'

describe('classStartUtc', () => {
  it('reads a CDT (DST) date as UTC-5', () => {
    // 2026-10-10 is in Central Daylight Time (ends first Sun of Nov). 09:00
    // CDT is 14:00 UTC.
    const d = classStartUtc('2026-10-10', '09:00')
    expect(d.toISOString()).toBe('2026-10-10T14:00:00.000Z')
  })

  it('reads a CST (standard) date as UTC-6', () => {
    // 2026-12-05 is in Central Standard Time. 09:00 CST = 15:00 UTC.
    const d = classStartUtc('2026-12-05', '09:00')
    expect(d.toISOString()).toBe('2026-12-05T15:00:00.000Z')
  })

  it('accepts HH:MM:SS as well as HH:MM', () => {
    const d = classStartUtc('2026-10-10', '09:00:00')
    expect(d.toISOString()).toBe('2026-10-10T14:00:00.000Z')
  })

  it('rejects malformed input', () => {
    expect(() => classStartUtc('10/10/2026', '09:00')).toThrow()
    expect(() => classStartUtc('2026-10-10', '9am')).toThrow()
  })
})

describe('rescheduleFee', () => {
  // Rule: 50% of the paid amount, rounded half-up to the nearest cent, returned
  // in integer cents. Fallback to the class list price when amount_paid is 0,
  // null, or missing.
  it('75.00 paid -> 3750 cents', () => {
    expect(rescheduleFee(75, 75)).toBe(3750)
  })
  it('90.00 paid -> 4500 cents', () => {
    expect(rescheduleFee(90, 75)).toBe(4500)
  })
  it('amount_paid=0 falls back to class price', () => {
    expect(rescheduleFee(0, 75)).toBe(3750)
  })
  it('amount_paid=null falls back to class price', () => {
    expect(rescheduleFee(null, 75)).toBe(3750)
    expect(rescheduleFee(undefined, 75)).toBe(3750)
  })
  it('75.01 paid rounds half-up to 3751', () => {
    // 50 % of 75.01 = 37.505 USD, which is 3750.5 cents. Round half up to 3751.
    expect(rescheduleFee(75.01, 75)).toBe(3751)
  })
  it('negative or NaN inputs produce 0', () => {
    expect(rescheduleFee(-50, 75)).toBe(3750) // treat negative as missing
    expect(rescheduleFee(0, Number.NaN)).toBe(0)
  })
})

describe('checkEligibility', () => {
  const baseFrom = {
    id: 'from-1',
    class_id: 'class-A',
    date: '2026-10-10',
    start_time: '09:00',
    status: 'scheduled',
    archived_at: null,
    current_enrollment: 5,
    max_capacity: 12,
  }
  const baseTo = {
    id: 'to-1',
    class_id: 'class-A',
    date: '2026-10-24',
    start_time: '09:00',
    status: 'scheduled',
    archived_at: null,
    current_enrollment: 3,
    max_capacity: 12,
  }
  // From-class starts at 2026-10-10 14:00:00 UTC (CDT 09:00).
  const START_MS = Date.UTC(2026, 9, 10, 14, 0, 0)
  // Target class starts well in the future.
  const okEnrollment = { status: 'confirmed', session_id: 'from-1' }

  it('24h01m before start is ok', () => {
    const now = new Date(START_MS - (24 * 60 + 1) * 60 * 1000)
    const result = checkEligibility({ enrollment: okEnrollment, fromSession: baseFrom, toSession: baseTo, now })
    expect(result.ok).toBe(true)
  })

  it('exactly 24h before start is ok', () => {
    const now = new Date(START_MS - 24 * 60 * 60 * 1000)
    const result = checkEligibility({ enrollment: okEnrollment, fromSession: baseFrom, toSession: baseTo, now })
    expect(result.ok).toBe(true)
  })

  it('23h59m before start is blocked (too_late)', () => {
    const now = new Date(START_MS - (23 * 60 + 59) * 60 * 1000)
    const result = checkEligibility({ enrollment: okEnrollment, fromSession: baseFrom, toSession: baseTo, now })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('too_late')
  })

  it('past class is blocked (already_started)', () => {
    const now = new Date(START_MS + 60 * 60 * 1000)
    const result = checkEligibility({ enrollment: okEnrollment, fromSession: baseFrom, toSession: baseTo, now })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('already_started')
  })

  it('different class_id is blocked', () => {
    const now = new Date(START_MS - 48 * 60 * 60 * 1000)
    const result = checkEligibility({
      enrollment: okEnrollment,
      fromSession: baseFrom,
      toSession: { ...baseTo, class_id: 'class-B' },
      now,
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('different_class')
  })

  it('full target is blocked (via explicit seats-taken count)', () => {
    const now = new Date(START_MS - 48 * 60 * 60 * 1000)
    const result = checkEligibility({
      enrollment: okEnrollment,
      fromSession: baseFrom,
      toSession: baseTo,
      now,
      toSessionSeatsTaken: 12,
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('target_full')
  })

  it('cancelled enrollment is blocked', () => {
    const now = new Date(START_MS - 48 * 60 * 60 * 1000)
    const result = checkEligibility({
      enrollment: { status: 'cancelled', session_id: 'from-1' },
      fromSession: baseFrom,
      toSession: baseTo,
      now,
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('enrollment_cancelled')
  })

  it('same session is blocked', () => {
    const now = new Date(START_MS - 48 * 60 * 60 * 1000)
    const result = checkEligibility({
      enrollment: okEnrollment,
      fromSession: baseFrom,
      toSession: baseFrom,
      now,
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('same_session')
  })
})

describe('reschedule tokens', () => {
  const enrollmentId = '11111111-2222-3333-4444-555555555555'

  beforeAll(() => {
    process.env.RESCHEDULE_TOKEN_SECRET =
      process.env.RESCHEDULE_TOKEN_SECRET ||
      'test-reschedule-secret-at-least-32-chars-long-abc'
  })

  it('round-trips a valid token', () => {
    const token = signRescheduleToken(enrollmentId)
    const result = verifyRescheduleToken(token)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.enrollmentId).toBe(enrollmentId)
  })

  it('rejects a tampered enrollmentId', () => {
    const token = signRescheduleToken(enrollmentId)
    const [eid, exp, sig] = token.split('.')
    const tampered = `${eid.replace(/./, 'f')}.${exp}.${sig}`
    expect(verifyRescheduleToken(tampered).ok).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const token = signRescheduleToken(enrollmentId)
    const [eid, exp, sig] = token.split('.')
    const tampered = `${eid}.${exp}.${sig.replace(/.$/, 'A')}`
    expect(verifyRescheduleToken(tampered).ok).toBe(false)
  })

  it('rejects an expired token', () => {
    // Sign with a now in the past, so the baked-in exp is also in the past.
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    const token = signRescheduleToken(enrollmentId, past)
    const result = verifyRescheduleToken(token)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('expired')
  })

  it('rejects an obviously malformed token', () => {
    expect(verifyRescheduleToken(null).ok).toBe(false)
    expect(verifyRescheduleToken('').ok).toBe(false)
    expect(verifyRescheduleToken('not-a-token').ok).toBe(false)
    expect(verifyRescheduleToken('a.b').ok).toBe(false)
  })

  it('exposes a sane TTL', () => {
    expect(RESCHEDULE_POLICY.tokenTtlSeconds).toBe(7 * 24 * 60 * 60)
  })
})
