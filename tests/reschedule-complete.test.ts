import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.RESCHEDULE_TOKEN_SECRET =
  process.env.RESCHEDULE_TOKEN_SECRET ||
  'test-reschedule-secret-at-least-32-chars-long-abc'
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-test-key'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'

// vi.mock factories are hoisted to the top of the file, so they cannot
// reference variables declared below. vi.hoisted lets us construct the
// mock *instances* in the same hoisted phase so the factories can close
// over them safely.
const mocks = vi.hoisted(() => ({
  sendEnrollmentConfirmationMock: vi.fn(async () => ({ success: true, messageId: 'm1' })),
  sendAdminAlertMock: vi.fn(async () => ({ success: true, messageId: 'm2' })),
}))

vi.mock('@/lib/email', () => ({
  sendEnrollmentConfirmation: mocks.sendEnrollmentConfirmationMock,
  sendAdminAlert: mocks.sendAdminAlertMock,
  escapeHtml: (v: unknown) => (v == null ? '' : String(v)),
}))
vi.mock('@/lib/stripe-server', () => ({
  stripe: {
    checkout: { sessions: { retrieve: vi.fn() } },
  },
}))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {},
}))

import { completeReschedule } from '@/lib/reschedule-complete'

// Supabase builder stub. Returns the configured response for every chain.
function makeSupabaseStub(opts: {
  claimFirstCall?: { data: unknown; error: unknown } | null
  claimSecondCall?: { data: unknown; error: unknown } | null
  rpcResult?: { data: string | null; error: unknown }
  loadEnrollment?: { data: unknown; error: unknown }
  updateFinal?: { data: unknown; error: unknown }
}) {
  const calls = {
    rpc: 0,
    updates: [] as Array<{ table: string }>,
    selects: 0,
  }

  // claim() is called exactly twice in the double-complete test. We route the
  // first ".update(.status='pending' RETURNING)" call to claimFirstCall and
  // the second to claimSecondCall (which returns null to simulate 'already
  // claimed').
  let claimCallCount = 0

  function fromBuilder(table: string) {
    const api: Record<string, unknown> = {}
    const chainable = () => api
    api.update = () => api
    api.insert = () => api
    api.select = (_cols?: string) => {
      calls.selects++
      return api
    }
    api.eq = () => api
    api.neq = () => api
    api.limit = () => api
    api.order = () => api

    if (table === 'reschedule_requests') {
      api.maybeSingle = async () => {
        claimCallCount++
        const which = claimCallCount === 1 ? opts.claimFirstCall : opts.claimSecondCall
        calls.updates.push({ table })
        return which ?? { data: null, error: null }
      }
      // final .update(..) .eq(..) with no .select() returns a promise that
      // resolves. Fake the thenable so `await` works.
      ;(api as unknown as { then: (resolve: (v: unknown) => unknown) => unknown }).then = (
        resolve: (v: unknown) => unknown
      ) => resolve(opts.updateFinal ?? { data: null, error: null })
    } else if (table === 'enrollments') {
      api.maybeSingle = async () => opts.loadEnrollment ?? { data: null, error: null }
    }
    return api
  }
  return {
    from: (table: string) => fromBuilder(table),
    rpc: async () => {
      calls.rpc++
      return opts.rpcResult ?? { data: 'ok', error: null }
    },
    _calls: calls,
  }
}

beforeEach(() => {
  mocks.sendEnrollmentConfirmationMock.mockClear()
  mocks.sendAdminAlertMock.mockClear()
})

describe('completeReschedule idempotency', () => {
  it('runs the RPC and sends emails exactly once across two calls for the same checkout session', async () => {
    const checkoutSession = {
      id: 'cs_test_123',
      payment_status: 'paid',
      payment_intent: 'pi_test_1',
      metadata: { type: 'reschedule', reschedule_request_id: 'rr-1' },
    }
    const stripe = {
      checkout: {
        sessions: {
          retrieve: vi.fn(async () => checkoutSession),
        },
      },
    }

    const supabase = makeSupabaseStub({
      claimFirstCall: {
        data: {
          id: 'rr-1',
          enrollment_id: 'enr-1',
          from_session_id: 'from-1',
          to_session_id: 'to-1',
          fee_amount: 37.5,
        },
        error: null,
      },
      claimSecondCall: { data: null, error: null },
      rpcResult: { data: 'ok', error: null },
      loadEnrollment: {
        data: {
          id: 'enr-1',
          guest_name: 'Student',
          guest_email: 's@example.com',
          session: {
            id: 'to-1',
            date: '2026-11-01',
            start_time: '09:00',
            end_time: '12:00',
            class: { name: 'BLS' },
          },
        },
        error: null,
      },
    })

    const first = await completeReschedule('cs_test_123', {
      supabase: supabase as unknown as Parameters<typeof completeReschedule>[1]['supabase'],
      stripe: stripe as unknown as Parameters<typeof completeReschedule>[1]['stripe'],
    })
    const second = await completeReschedule('cs_test_123', {
      supabase: supabase as unknown as Parameters<typeof completeReschedule>[1]['supabase'],
      stripe: stripe as unknown as Parameters<typeof completeReschedule>[1]['stripe'],
    })

    expect(first.status).toBe('ok')
    expect(second.status).toBe('already_processed')
    expect(supabase._calls.rpc).toBe(1)
    expect(mocks.sendEnrollmentConfirmationMock).toHaveBeenCalledTimes(1)
    // Admin "Reschedule completed" alert also fires exactly once.
    expect(mocks.sendAdminAlertMock).toHaveBeenCalledTimes(1)
  })

  it('short-circuits when the Checkout Session is not paid yet', async () => {
    const stripe = {
      checkout: {
        sessions: {
          retrieve: vi.fn(async () => ({
            id: 'cs_test_unpaid',
            payment_status: 'unpaid',
            metadata: { type: 'reschedule', reschedule_request_id: 'rr-x' },
          })),
        },
      },
    }
    const supabase = makeSupabaseStub({})
    const result = await completeReschedule('cs_test_unpaid', {
      supabase: supabase as unknown as Parameters<typeof completeReschedule>[1]['supabase'],
      stripe: stripe as unknown as Parameters<typeof completeReschedule>[1]['stripe'],
    })
    expect(result.status).toBe('not_paid')
    expect(supabase._calls.rpc).toBe(0)
    expect(mocks.sendEnrollmentConfirmationMock).not.toHaveBeenCalled()
  })

  it("flips to failed_full and alerts admin when the RPC returns 'full'", async () => {
    const stripe = {
      checkout: {
        sessions: {
          retrieve: vi.fn(async () => ({
            id: 'cs_full',
            payment_status: 'paid',
            payment_intent: 'pi_full',
            metadata: { type: 'reschedule', reschedule_request_id: 'rr-full' },
          })),
        },
      },
    }
    const supabase = makeSupabaseStub({
      claimFirstCall: {
        data: {
          id: 'rr-full',
          enrollment_id: 'enr-f',
          from_session_id: 'from-f',
          to_session_id: 'to-f',
          fee_amount: 37.5,
        },
        error: null,
      },
      rpcResult: { data: 'full', error: null },
    })
    const result = await completeReschedule('cs_full', {
      supabase: supabase as unknown as Parameters<typeof completeReschedule>[1]['supabase'],
      stripe: stripe as unknown as Parameters<typeof completeReschedule>[1]['stripe'],
    })
    expect(result.status).toBe('rpc_failed')
    expect(result.status === 'rpc_failed' && result.rpcResult).toBe('full')
    expect(result.status === 'rpc_failed' && result.paidButUnmoved).toBe(true)
    // Confirmation NOT sent — the seat didn't move.
    expect(mocks.sendEnrollmentConfirmationMock).not.toHaveBeenCalled()
    // Admin alert IS sent — "paid but target unavailable".
    expect(mocks.sendAdminAlertMock).toHaveBeenCalledTimes(1)
  })
})
