import 'server-only'
import crypto from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'

// Student session cookie. HMAC-SHA256 signed with STUDENT_SESSION_SECRET.
// Same pattern as lib/admin-auth.ts but no session_epoch (students have no
// password to change, and we have no revocation UI). SameSite=Lax because
// students may arrive via a link in an email; Strict would break that flow.
// 7-day TTL — the cookie grants access to name/phone/payment history, and
// there is no revocation path. Re-requesting a code takes ~30 seconds, so
// the friction of expiry is small compared to the shared-computer risk.

export const STUDENT_COOKIE_NAME = 'student_session'
export const STUDENT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

export const STUDENT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export class StudentUnauthorizedError extends Error {
  constructor(public reason: 'missing' | 'invalid' | 'expired') {
    super(`student session ${reason}`)
    this.name = 'StudentUnauthorizedError'
  }
}

export interface StudentSession {
  email: string
  exp: number
}

function getSecret(): Buffer {
  const s = process.env.STUDENT_SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('STUDENT_SESSION_SECRET must be set (min 32 chars)')
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

export function issueStudentSession(email: string): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + STUDENT_SESSION_TTL_SECONDS
  const payload: StudentSession = { email, exp }
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = sign(payloadB64)
  return { value: `${payloadB64}.${sig}`, maxAge: STUDENT_SESSION_TTL_SECONDS }
}

export function verifyStudentSession(cookieValue: string | undefined): StudentSession {
  if (!cookieValue) throw new StudentUnauthorizedError('missing')
  const parts = cookieValue.split('.')
  if (parts.length !== 2) throw new StudentUnauthorizedError('invalid')
  const [payloadB64, providedSig] = parts

  const expectedSig = sign(payloadB64)
  const providedBuf = Buffer.from(providedSig, 'utf8')
  const expectedBuf = Buffer.from(expectedSig, 'utf8')
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    throw new StudentUnauthorizedError('invalid')
  }

  let payload: StudentSession
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'))
  } catch {
    throw new StudentUnauthorizedError('invalid')
  }

  if (typeof payload.exp !== 'number' || typeof payload.email !== 'string') {
    throw new StudentUnauthorizedError('invalid')
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new StudentUnauthorizedError('expired')
  }

  return payload
}

// Reads and verifies the student cookie. No DB round-trip (unlike
// requireAdmin) — student sessions are not revocable at this scale.
export async function requireStudent(req: NextRequest): Promise<StudentSession> {
  const cookie = req.cookies.get(STUDENT_COOKIE_NAME)?.value
  return verifyStudentSession(cookie)
}

export function studentUnauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function guardedStudent(
  req: NextRequest,
  fn: (student: StudentSession) => Promise<NextResponse>
): Promise<NextResponse> {
  let student: StudentSession
  try {
    student = await requireStudent(req)
  } catch (e) {
    if (e instanceof StudentUnauthorizedError) return studentUnauthorizedResponse()
    throw e
  }
  return fn(student)
}
