import 'server-only'
import crypto from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const ADMIN_COOKIE_NAME = 'admin_session'
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 2 // 2h

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}

export class AdminUnauthorizedError extends Error {
  constructor(public reason: 'missing' | 'invalid' | 'expired' | 'revoked') {
    super(`admin session ${reason}`)
    this.name = 'AdminUnauthorizedError'
  }
}

export interface AdminSession {
  adminId: string
  email: string
  epoch: number
  exp: number
}

function getSecret(): Buffer {
  const s = process.env.ADMIN_SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be set (min 32 chars)')
  }
  return Buffer.from(s, 'utf8')
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function sign(payloadB64: string): string {
  const mac = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest()
  return base64UrlEncode(mac)
}

export function issueAdminSession(admin: { adminId: string; email: string; epoch: number }): {
  value: string
  maxAge: number
} {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS
  const payload: AdminSession = {
    adminId: admin.adminId,
    email: admin.email,
    epoch: admin.epoch,
    exp,
  }
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = sign(payloadB64)
  return { value: `${payloadB64}.${sig}`, maxAge: ADMIN_SESSION_TTL_SECONDS }
}

// Signature/expiry check only. Does NOT verify the epoch against the DB —
// callers who need revocation semantics (all cookies at once, e.g. after a
// password change) must use requireAdmin, which layers a DB read on top.
export function verifyAdminSession(cookieValue: string | undefined): AdminSession {
  if (!cookieValue) throw new AdminUnauthorizedError('missing')
  const parts = cookieValue.split('.')
  if (parts.length !== 2) throw new AdminUnauthorizedError('invalid')
  const [payloadB64, providedSig] = parts

  const expectedSig = sign(payloadB64)
  const providedBuf = Buffer.from(providedSig, 'utf8')
  const expectedBuf = Buffer.from(expectedSig, 'utf8')
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    throw new AdminUnauthorizedError('invalid')
  }

  let payload: AdminSession
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'))
  } catch {
    throw new AdminUnauthorizedError('invalid')
  }

  if (
    typeof payload.exp !== 'number' ||
    typeof payload.adminId !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.epoch !== 'number'
  ) {
    throw new AdminUnauthorizedError('invalid')
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AdminUnauthorizedError('expired')
  }

  return payload
}

// Full auth check for gated route handlers: verifies the signed cookie AND
// looks up the admin's current session_epoch in the DB. Bumping the epoch
// (see /api/admin/change-password) invalidates every outstanding cookie for
// that admin on every device.
export async function requireAdmin(req: NextRequest): Promise<AdminSession> {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  const session = verifyAdminSession(cookie)

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('session_epoch')
    .eq('id', session.adminId)
    .eq('role', 'admin')
    .maybeSingle()

  if (error) {
    console.error('[REQUIRE_ADMIN] Failed to read session_epoch:', error)
    throw new AdminUnauthorizedError('invalid')
  }
  if (!data || typeof data.session_epoch !== 'number') {
    throw new AdminUnauthorizedError('revoked')
  }
  if (data.session_epoch !== session.epoch) {
    throw new AdminUnauthorizedError('revoked')
  }

  return session
}

// Standard 401 response body used by every gated handler.
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Small wrapper to remove try/catch boilerplate from each gated handler.
// If the request lacks admin auth, returns 401 automatically; otherwise
// invokes fn with the admin session and returns its response.
export async function guarded(
  req: NextRequest,
  fn: (admin: AdminSession) => Promise<NextResponse>
): Promise<NextResponse> {
  let admin: AdminSession
  try {
    admin = await requireAdmin(req)
  } catch (e) {
    if (e instanceof AdminUnauthorizedError) return unauthorizedResponse()
    throw e
  }
  return fn(admin)
}
