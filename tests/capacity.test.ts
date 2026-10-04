import { describe, it, expect } from 'vitest'
import {
  isSessionFullError,
  isSessionFull,
  spotsLeft,
  SESSION_FULL_PREFIX,
} from '@/lib/capacity'

describe('isSessionFullError', () => {
  it('matches the Postgres SESSION_FULL prefix', () => {
    expect(isSessionFullError({ message: 'SESSION_FULL: session is full' })).toBe(true)
  })

  it('matches when the prefix is embedded in a longer PostgREST error string', () => {
    // Supabase wraps the raise exception in its own envelope; the prefix
    // may or may not sit at the start of the final message.
    expect(
      isSessionFullError({
        message: 'new row violates: SESSION_FULL max_capacity=12',
        code: 'P0001',
      })
    ).toBe(true)
  })

  it('does not match other errors', () => {
    expect(isSessionFullError({ message: 'duplicate key value violates unique constraint' })).toBe(false)
    expect(isSessionFullError({ message: 'permission denied' })).toBe(false)
    expect(isSessionFullError({ message: '' })).toBe(false)
  })

  it('does not match non-error inputs', () => {
    expect(isSessionFullError(null)).toBe(false)
    expect(isSessionFullError(undefined)).toBe(false)
    expect(isSessionFullError('SESSION_FULL')).toBe(false) // plain string, no .message
    expect(isSessionFullError({})).toBe(false)
    expect(isSessionFullError({ message: 42 })).toBe(false)
  })

  it('exposes the prefix as a constant', () => {
    expect(SESSION_FULL_PREFIX).toBe('SESSION_FULL')
  })
})

describe('spotsLeft', () => {
  it('returns max_capacity when no seats are taken', () => {
    expect(spotsLeft(12, 0)).toBe(12)
  })

  it('returns 1 when one seat is left', () => {
    expect(spotsLeft(12, 11)).toBe(1)
  })

  it('returns 0 at exact capacity', () => {
    expect(spotsLeft(12, 12)).toBe(0)
  })

  it('clamps negative results to 0 when the counter has drifted past capacity', () => {
    // The 10/03 case: 13 rows, max_capacity=12. The display must never show
    // a negative number, it should show 0 so the UI reads "0 spots available"
    // and the Add-to-Cart stays disabled.
    expect(spotsLeft(12, 13)).toBe(0)
  })

  it('returns 0 for non-finite input rather than NaN', () => {
    expect(spotsLeft(Number.NaN, 5)).toBe(0)
    expect(spotsLeft(12, Number.NaN)).toBe(0)
    expect(spotsLeft(Number.POSITIVE_INFINITY, 5)).toBe(0)
  })
})

describe('isSessionFull', () => {
  it('is false when there is at least one spot', () => {
    expect(isSessionFull(12, 11)).toBe(false)
  })

  it('is true at exactly max_capacity', () => {
    expect(isSessionFull(12, 12)).toBe(true)
  })

  it('is true when the counter has drifted past max_capacity', () => {
    expect(isSessionFull(12, 13)).toBe(true)
  })

  it('is false when no seats are taken', () => {
    expect(isSessionFull(12, 0)).toBe(false)
  })
})
