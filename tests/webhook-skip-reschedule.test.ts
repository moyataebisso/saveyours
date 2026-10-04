import { describe, it, expect, vi, beforeEach } from 'vitest'

// Env needs to be ready before any module that calls getEnv at import time
// (supabase-admin, stripe-server) is pulled in via the webhook route.
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_dummy'
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-test-key'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'
process.env.RESCHEDULE_TOKEN_SECRET =
  process.env.RESCHEDULE_TOKEN_SECRET ||
  'test-reschedule-secret-at-least-32-chars-long-abc'

// vi.mock is hoisted to the top of the file, which means its factory cannot
// reference variables declared below. Using vi.hoisted lets us put the mock
// *instances* alongside the mocks so they're constructed before vi.mock runs.
const mocks = vi.hoisted(() => {
  return {
    supabaseFromMock: vi.fn(),
    supabaseRpcMock: vi.fn(),
    constructEventMock: vi.fn(),
    sendEnrollmentConfirmationMock: vi.fn(),
    sendVoucherEmailMock: vi.fn(),
    sendAdminAlertMock: vi.fn(),
    completeRescheduleMock: vi.fn(async () => ({ status: 'ok', newSessionId: 'to-1' })),
  }
})

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: mocks.supabaseFromMock,
    rpc: mocks.supabaseRpcMock,
  },
}))

vi.mock('@/lib/stripe-server', () => ({
  stripe: {
    webhooks: { constructEvent: mocks.constructEventMock },
    checkout: { sessions: { retrieve: vi.fn() } },
    paymentIntents: { retrieve: vi.fn() },
  },
}))

vi.mock('@/lib/email', () => ({
  sendEnrollmentConfirmation: mocks.sendEnrollmentConfirmationMock,
  sendVoucherEmail: mocks.sendVoucherEmailMock,
  sendAdminAlert: mocks.sendAdminAlertMock,
  escapeHtml: (v: unknown) => (v == null ? '' : String(v)),
}))

vi.mock('@/lib/reschedule-complete', () => ({
  completeReschedule: mocks.completeRescheduleMock,
}))

import { POST } from '@/app/api/webhook/stripe/route'

beforeEach(() => {
  mocks.supabaseFromMock.mockReset()
  mocks.supabaseRpcMock.mockReset()
  mocks.constructEventMock.mockReset()
  mocks.sendEnrollmentConfirmationMock.mockReset()
  mocks.sendVoucherEmailMock.mockReset()
  mocks.sendAdminAlertMock.mockReset()
  mocks.completeRescheduleMock.mockClear()
})

function fakeRequest() {
  return {
    text: async () => 'raw-body',
    headers: {
      get: (name: string) => (name === 'stripe-signature' ? 'sig_test' : null),
    },
  } as unknown as Parameters<typeof POST>[0]
}

describe('webhook skips reschedule PaymentIntents', () => {
  it('payment_intent.succeeded with metadata.type=reschedule does NOT create an enrollment', async () => {
    mocks.constructEventMock.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_resched',
          amount: 3750,
          metadata: {
            type: 'reschedule',
            reschedule_request_id: 'rr-1',
            enrollment_id: 'enr-1',
          },
        },
      },
    })

    const res = await POST(fakeRequest())
    expect(res.status).toBe(200)

    // Hard-assert the critical safety property: the enrollment path never ran.
    expect(mocks.supabaseFromMock).not.toHaveBeenCalled()
    expect(mocks.supabaseRpcMock).not.toHaveBeenCalled()
    expect(mocks.sendEnrollmentConfirmationMock).not.toHaveBeenCalled()
    expect(mocks.sendVoucherEmailMock).not.toHaveBeenCalled()
  })

  it('checkout.session.completed with metadata.type=reschedule invokes completeReschedule', async () => {
    mocks.constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_resched_1',
          metadata: { type: 'reschedule', reschedule_request_id: 'rr-1' },
        },
      },
    })

    const res = await POST(fakeRequest())
    expect(res.status).toBe(200)

    expect(mocks.completeRescheduleMock).toHaveBeenCalledTimes(1)
    expect(mocks.completeRescheduleMock).toHaveBeenCalledWith('cs_resched_1')
  })
})
