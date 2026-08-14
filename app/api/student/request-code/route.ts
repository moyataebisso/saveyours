import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendStudentOtpEmail } from '@/lib/email'
import { checkFormSubmission } from '@/lib/form-guard'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 3
const MAX_REQUESTS_PER_IP_PER_HOUR = 5
const ONE_HOUR_MS = 60 * 60 * 1000

// Every path returns the same {ok:true} — never reveal whether an email
// exists, whether it hit a rate limit, or whether the send failed. Bots
// enumerate accounts through response differences; the shape stays flat.
const SILENT_OK = { ok: true } as const

function silentOk() {
  return NextResponse.json(SILENT_OK)
}

function generateSixDigitCode(): string {
  // crypto.randomInt is uniform and safe. Range [0, 1000000) formatted to 6.
  const n = crypto.randomInt(0, 1_000_000)
  return String(n).padStart(6, '0')
}

function extractIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  // Cheap-first filter. Silent-accept on any guard hit.
  const guard = checkFormSubmission(req, body, {
    formName: 'student-otp-request',
    honeypot: true,
    timing: { minSeconds: 3 },
  })
  if (guard.decision === 'silent-accept') return silentOk()

  const rawEmail = typeof body?.email === 'string' ? body.email : ''
  const email = rawEmail.trim().toLowerCase()
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) return silentOk()

  const ip = extractIp(req)
  const sinceIso = new Date(Date.now() - ONE_HOUR_MS).toISOString()

  // DB-backed rate limits — survive across serverless instances. Two counts
  // in parallel: one per email, one per IP.
  const [emailCountRes, ipCountRes] = await Promise.all([
    supabaseAdmin
      .from('student_otp')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
      .gt('created_at', sinceIso),
    supabaseAdmin
      .from('student_otp')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gt('created_at', sinceIso),
  ])

  const emailCount = emailCountRes.count ?? 0
  const ipCount = ipCountRes.count ?? 0
  if (emailCount >= MAX_REQUESTS_PER_EMAIL_PER_HOUR || ipCount >= MAX_REQUESTS_PER_IP_PER_HOUR) {
    console.warn('[STUDENT_OTP] Rate limit exceeded', {
      emailPrefix: email.slice(0, 3) + '***',
      ip,
      emailCount,
      ipCount,
    })
    return silentOk()
  }

  const code = generateSixDigitCode()
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  const { error: insertError } = await supabaseAdmin.from('student_otp').insert({
    email,
    code_hash: codeHash,
    ip_address: ip,
    expires_at: expiresAt,
  })

  if (insertError) {
    console.error('[STUDENT_OTP] Insert failed:', insertError)
    return silentOk()
  }

  // Email best-effort — a failure here still returns silent-ok. User sees
  // "we sent a code" but never receives; they'll try again or contact us.
  try {
    const emailResult = await sendStudentOtpEmail(email, code)
    if (!emailResult?.success) {
      console.error('[STUDENT_OTP] Email did not succeed:', emailResult)
    }
  } catch (e) {
    console.error('[STUDENT_OTP] Email send threw:', e)
  }

  return silentOk()
}
