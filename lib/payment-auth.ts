import 'server-only'
import crypto from 'crypto'
import type { NextRequest } from 'next/server'

// HttpOnly signed cookie of PaymentIntent ids this browser owns. Set by
// /api/payment/create-intent; verified by /api/payment/update-intent and
// /api/payment/cancel-intent. Cross-browser attackers who guess a PI id
// cannot use it without this cookie.

export const PI_COOKIE_NAME = 'pi_ownership'
export const PI_COOKIE_TTL_SECONDS = 60 * 60 * 24 // 24h
// Cap how many PI ids we retain per cookie. Cart flows create a new PI on
// mount and again on every remove-item, so an idle tab can accumulate ids.
// Keep the newest N — older ones will fall out on rotation. This is also the
// upper bound on cookie size (~48 bytes per id).
const MAX_OWNED_IDS = 32

export const PI_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
}

interface Payload {
  pids: string[]
  exp: number
}

function getSecret(): Buffer {
  const s = process.env.PI_OWNERSHIP_SECRET
  if (!s || s.length < 32) {
    throw new Error('PI_OWNERSHIP_SECRET must be set (min 32 chars)')
  }
  return Buffer.from(s, 'utf8')
}

function b64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function sign(payloadB64: string): string {
  const mac = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest()
  return b64UrlEncode(mac)
}

function verify(cookieValue: string): Payload | null {
  const parts = cookieValue.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, providedSig] = parts

  const expectedSig = sign(payloadB64)
  const providedBuf = Buffer.from(providedSig, 'utf8')
  const expectedBuf = Buffer.from(expectedSig, 'utf8')
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return null
  }

  let payload: Payload
  try {
    payload = JSON.parse(b64UrlDecode(payloadB64).toString('utf8'))
  } catch {
    return null
  }

  if (
    !Array.isArray(payload.pids) ||
    !payload.pids.every((p) => typeof p === 'string') ||
    typeof payload.exp !== 'number'
  ) {
    return null
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) return null

  return payload
}

// Returns the PI ids the browser currently owns, or [] if no valid cookie.
// Absent/tampered/expired all fold to [] — callers decide the response code.
export function readOwnedPiIds(req: NextRequest): string[] {
  const cookie = req.cookies.get(PI_COOKIE_NAME)?.value
  if (!cookie) return []
  const payload = verify(cookie)
  return payload?.pids ?? []
}

// Given the request's existing cookie (may be missing/expired) and a fresh
// PaymentIntent id, produce a new cookie value that includes the id at the
// front, deduped, capped at MAX_OWNED_IDS. Always resets the expiry.
export function issuePiOwnershipCookie(req: NextRequest, newPiId: string): {
  value: string
  maxAge: number
} {
  const existing = readOwnedPiIds(req)
  const merged = [newPiId, ...existing.filter((id) => id !== newPiId)].slice(0, MAX_OWNED_IDS)

  const exp = Math.floor(Date.now() / 1000) + PI_COOKIE_TTL_SECONDS
  const payload: Payload = { pids: merged, exp }
  const payloadB64 = b64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = sign(payloadB64)
  return { value: `${payloadB64}.${sig}`, maxAge: PI_COOKIE_TTL_SECONDS }
}

// True iff piId is present in the browser's signed ownership cookie.
export function browserOwnsPi(req: NextRequest, piId: string): boolean {
  return readOwnedPiIds(req).includes(piId)
}
