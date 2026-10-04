// Pure (and pure-ish) helpers for the self-serve paid-reschedule flow.
//
// This file is unit-tested from tests/reschedule.test.ts. Keep it free of
// Supabase/Stripe imports so it can run under node without network side-effects.
// The crypto import is Node's stdlib and is safe in both server and test runs.

import crypto from 'crypto'

export const RESCHEDULE_POLICY = {
  // Must be >= 24h before class starts in America/Chicago. Expressed in ms so
  // the eligibility check can do a single arithmetic comparison.
  minHoursBefore: 24,
  minMsBefore: 24 * 60 * 60 * 1000,
  // 50 % of what the student actually paid, rounded to the nearest cent (round
  // half up). If amount_paid is missing (comped, manual admin add), fall back
  // to 50 % of the class list price so the student still pays a fee.
  feePercent: 0.5,
  tokenTtlSeconds: 7 * 24 * 60 * 60,
}

export const RESCHEDULE_POLICY_SUMMARY =
  'You may reschedule to another date in the same class by paying a fee of 50 % of your original purchase. ' +
  'Rescheduling is not available within 24 hours of your scheduled start time.'

// Parse a YYYY-MM-DD date string + an HH:MM[:SS] time string as a wall-clock
// moment in America/Chicago, returning the absolute Date in UTC.
//
// We DO NOT use `new Date('2026-10-10')` or `new Date('2026-10-10T09:00:00')`
// anywhere in this repo — those parse as UTC midnight on some paths, which has
// bitten us with "day-shift" bugs in the past (session_row and class-page
// components still carry the comments). This helper does the correct thing by
// construction.
//
// Approach: naive-UTC first, then ask Intl what Chicago shows for that naive
// Date, and nudge by the difference. Correct for both CDT and CST and does
// not require date-fns-tz.
export function classStartUtc(dateStr: string, timeStr: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!dateMatch) throw new Error(`classStartUtc: invalid date ${dateStr}`)
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr)
  if (!timeMatch) throw new Error(`classStartUtc: invalid time ${timeStr}`)

  const y = Number(dateMatch[1])
  const mo = Number(dateMatch[2])
  const d = Number(dateMatch[3])
  const h = Number(timeMatch[1])
  const mi = Number(timeMatch[2])
  const se = timeMatch[3] ? Number(timeMatch[3]) : 0

  // Start by assuming the wall clock IS UTC. This is wrong but close — we'll
  // measure the error against Chicago's actual wall clock at that instant and
  // subtract it.
  const naive = Date.UTC(y, mo - 1, d, h, mi, se)
  const partsAtNaive = chicagoParts(new Date(naive))
  const wall = Date.UTC(
    partsAtNaive.year,
    partsAtNaive.month - 1,
    partsAtNaive.day,
    partsAtNaive.hour,
    partsAtNaive.minute,
    partsAtNaive.second,
  )
  // offsetMs = how far behind UTC Chicago currently sits.
  // Example: naive = 2026-10-10 09:00Z, Chicago reads that as 04:00 CDT →
  // wall = 2026-10-10 04:00Z, offsetMs = 5h. Add offsetMs to naive to get the
  // UTC moment when Chicago's clock reads 09:00.
  const offsetMs = naive - wall
  return new Date(naive + offsetMs)
}

// Internal: extract Chicago wall-clock components for a given UTC Date using
// Intl.DateTimeFormat. Returns a plain object of numbers.
function chicagoParts(d: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  // en-CA gives ISO-ish numeric parts that are easy to pull from formatToParts.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = fmt.formatToParts(d)
  const bucket: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') bucket[p.type] = p.value
  }
  return {
    year: Number(bucket.year),
    month: Number(bucket.month),
    day: Number(bucket.day),
    hour: Number(bucket.hour),
    minute: Number(bucket.minute),
    second: Number(bucket.second),
  }
}

// 50 % of amount_paid, rounded half-up to the nearest cent, in integer cents.
// If amount_paid is 0 / null / undefined (comped or manually added without
// payment), fall back to 50 % of the class list price so we still charge a
// real fee. 75.01 -> 3751 (round half up — document the rule here so Meea can
// cite it if challenged).
export function rescheduleFee(amountPaid: number | null | undefined, classPrice: number): number {
  const useAmount =
    typeof amountPaid === 'number' && Number.isFinite(amountPaid) && amountPaid > 0
      ? amountPaid
      : classPrice
  if (!Number.isFinite(useAmount) || useAmount < 0) return 0
  // Convert to cents first, then halve, then round half up (toward +Infinity
  // at exactly 0.5). Doing the half-up in integer space avoids float rounding
  // like 37.505 -> 37.504999.
  const feeCents = useAmount * 50 // dollars * 100 * 0.5 = dollars * 50
  return Math.floor(feeCents + 0.5)
}

export type Eligibility =
  | { ok: true }
  | { ok: false; reason: EligibilityReason; message: string }

export type EligibilityReason =
  | 'enrollment_cancelled'
  | 'enrollment_completed'
  | 'too_late'
  | 'already_started'
  | 'same_session'
  | 'different_class'
  | 'target_cancelled'
  | 'target_archived'
  | 'target_past'
  | 'target_full'

interface EnrollmentLike {
  status: string
  session_id: string
}

interface SessionLike {
  id: string
  class_id: string
  date: string
  start_time: string
  status: string | null
  archived_at: string | null
  current_enrollment: number
  max_capacity: number
}

export function checkEligibility(args: {
  enrollment: EnrollmentLike
  fromSession: SessionLike
  toSession: SessionLike
  now: Date
  // Optional: real seats taken (count of non-cancelled enrollment rows) if
  // the caller has it. Keeps the pure function unit-testable while letting
  // the live page pass the authoritative count instead of the counter.
  toSessionSeatsTaken?: number
}): Eligibility {
  const { enrollment, fromSession, toSession, now, toSessionSeatsTaken } = args

  if (enrollment.status === 'cancelled') {
    return {
      ok: false,
      reason: 'enrollment_cancelled',
      message: 'This enrollment has been cancelled, so it cannot be rescheduled.',
    }
  }
  if (enrollment.status === 'completed') {
    return {
      ok: false,
      reason: 'enrollment_completed',
      message: 'This enrollment has already been completed and cannot be rescheduled.',
    }
  }

  const fromStartUtc = classStartUtc(fromSession.date, fromSession.start_time)
  const nowMs = now.getTime()
  const startMs = fromStartUtc.getTime()
  if (nowMs >= startMs) {
    return {
      ok: false,
      reason: 'already_started',
      message: 'This class has already started, so it cannot be rescheduled online.',
    }
  }
  // Exactly 24h is OK; strictly less than 24h is blocked. The user explicitly
  // asked for "24h01m before -> ok; 23h59m -> blocked; exactly 24h -> ok".
  if (startMs - nowMs < RESCHEDULE_POLICY.minMsBefore) {
    return {
      ok: false,
      reason: 'too_late',
      message:
        'This class starts in less than 24 hours, so it can no longer be rescheduled online. ' +
        'Email info@saveyours.net if you need help.',
    }
  }

  if (toSession.id === fromSession.id) {
    return {
      ok: false,
      reason: 'same_session',
      message: 'Choose a different session than the one you are already in.',
    }
  }
  if (toSession.class_id !== fromSession.class_id) {
    return {
      ok: false,
      reason: 'different_class',
      message: 'You can only reschedule to another session of the same class.',
    }
  }
  if (toSession.status === 'cancelled') {
    return {
      ok: false,
      reason: 'target_cancelled',
      message: 'That session has been cancelled.',
    }
  }
  if (toSession.archived_at) {
    return {
      ok: false,
      reason: 'target_archived',
      message: 'That session has been archived.',
    }
  }
  const toStart = classStartUtc(toSession.date, toSession.start_time)
  if (toStart.getTime() <= nowMs) {
    return {
      ok: false,
      reason: 'target_past',
      message: 'That session is in the past.',
    }
  }
  const seats =
    typeof toSessionSeatsTaken === 'number' ? toSessionSeatsTaken : toSession.current_enrollment
  if (seats >= toSession.max_capacity) {
    return {
      ok: false,
      reason: 'target_full',
      message: 'That session is full. Please pick a different date.',
    }
  }

  return { ok: true }
}

// Signed reschedule token. 7-day TTL. Encodes exactly `${enrollmentId}.${exp}`
// so it is impossible to swap enrollmentId or expiry without invalidating the
// HMAC. Mirrors the admin-session helper's shape, but kept separate so
// RESCHEDULE_TOKEN_SECRET rotation is independent of admin cookies.
//
// Format: `<enrollmentId>.<expUnix>.<hmacBase64Url>`
//
// Secret is loaded on each call so test setups can set it via process.env
// before importing modules that use it indirectly.
function getTokenSecret(): Buffer {
  const s = process.env.RESCHEDULE_TOKEN_SECRET
  if (!s || s.length < 32) {
    throw new Error('RESCHEDULE_TOKEN_SECRET must be set (min 32 chars)')
  }
  return Buffer.from(s, 'utf8')
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function hmac(input: string): string {
  const mac = crypto.createHmac('sha256', getTokenSecret()).update(input).digest()
  return base64UrlEncode(mac)
}

export function signRescheduleToken(enrollmentId: string, now: Date = new Date()): string {
  if (!/^[0-9a-f-]{10,}$/i.test(enrollmentId)) {
    throw new Error('signRescheduleToken: enrollmentId must be a uuid-like string')
  }
  const exp = Math.floor(now.getTime() / 1000) + RESCHEDULE_POLICY.tokenTtlSeconds
  const payload = `${enrollmentId}.${exp}`
  const sig = hmac(payload)
  return `${payload}.${sig}`
}

export type TokenVerifyResult =
  | { ok: true; enrollmentId: string; exp: number }
  | { ok: false; reason: 'invalid' | 'expired' }

export function verifyRescheduleToken(
  token: string | null | undefined,
  now: Date = new Date()
): TokenVerifyResult {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'invalid' }
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'invalid' }
  const [enrollmentId, expStr, providedSig] = parts
  if (!enrollmentId || !expStr || !providedSig) return { ok: false, reason: 'invalid' }

  const expNum = Number(expStr)
  if (!Number.isFinite(expNum)) return { ok: false, reason: 'invalid' }

  const expectedSig = hmac(`${enrollmentId}.${expStr}`)
  const provided = Buffer.from(providedSig, 'utf8')
  const expected = Buffer.from(expectedSig, 'utf8')
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'invalid' }
  }

  if (expNum < Math.floor(now.getTime() / 1000)) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, enrollmentId, exp: expNum }
}
