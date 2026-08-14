import 'server-only'
import crypto from 'crypto'
import type { NextRequest } from 'next/server'

export const ADMIN_COOKIE_NAME = 'admin_session'
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 2 // 2h

// Cookie flags applied to every write of admin_session (issue AND clear). Kept
// as a single source of truth so a mismatch between set/clear can't leave a
// stale cookie on the browser. Secure only in production because localhost dev
// runs over http and browsers drop Secure cookies on http.
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}

export class AdminUnauthorizedError extends Error {
  constructor(public reason: 'missing' | 'invalid' | 'expired') {
    super(`admin session ${reason}`)
    this.name = 'AdminUnauthorizedError'
  }
}

export interface AdminSession {
  adminId: string
  email: string
  exp: number
}

// Lazy so that importing this module never throws at build time on machines
// that haven't set the secret locally. First actual sign/verify call is the
// point where a missing secret becomes fatal.
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

export function issueAdminSession(admin: { adminId: string; email: string }): {
  value: string
  maxAge: number
} {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS
  const payload: AdminSession = { adminId: admin.adminId, email: admin.email, exp }
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = sign(payloadB64)
  return { value: `${payloadB64}.${sig}`, maxAge: ADMIN_SESSION_TTL_SECONDS }
}

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
    typeof payload.email !== 'string'
  ) {
    throw new AdminUnauthorizedError('invalid')
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AdminUnauthorizedError('expired')
  }

  return payload
}

export async function requireAdmin(req: NextRequest): Promise<AdminSession> {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminSession(cookie)
}
