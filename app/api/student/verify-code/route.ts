import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  issueStudentSession,
  STUDENT_COOKIE_NAME,
  STUDENT_COOKIE_OPTIONS,
} from '@/lib/student-auth'

const MAX_ATTEMPTS_PER_CODE = 5

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const rawEmail = typeof body?.email === 'string' ? body.email : ''
  const email = rawEmail.trim().toLowerCase()
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  // Generic "invalid or expired code" for every failure path — same reason
  // as the login route: reveal nothing about which check tripped.
  const invalid = () =>
    NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })

  if (!email || !code || !/^\d{6}$/.test(code)) return invalid()

  // Pick the most recent unconsumed, unexpired OTP for this email.
  const nowIso = new Date().toISOString()
  const { data: rows, error: readError } = await supabaseAdmin
    .from('student_otp')
    .select('id, code_hash, attempts, consumed_at')
    .eq('email', email)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)

  if (readError) {
    console.error('[STUDENT_VERIFY] Read failed:', readError)
    return invalid()
  }
  const row = rows?.[0]
  if (!row) return invalid()

  if (row.attempts >= MAX_ATTEMPTS_PER_CODE) {
    console.warn('[STUDENT_VERIFY] Code exhausted', { id: row.id })
    return invalid()
  }

  const match = await bcrypt.compare(code, row.code_hash)

  if (!match) {
    // Increment attempts. Best-effort — a failure to increment doesn't
    // block the user from ultimately succeeding; the code is still capped
    // by expiry and by the attempt counter's cumulative writes.
    const { error: bumpError } = await supabaseAdmin
      .from('student_otp')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
    if (bumpError) console.error('[STUDENT_VERIFY] Attempt bump failed:', bumpError)
    return invalid()
  }

  // Consume the code so it can't be reused. Concurrent verifies from the
  // same code race harmlessly — worst case the second one flips consumed_at
  // to a slightly later timestamp; both requests still succeed with valid
  // cookies, which is fine because they're the same user's device.
  const { error: consumeError } = await supabaseAdmin
    .from('student_otp')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)
  if (consumeError) {
    console.error('[STUDENT_VERIFY] Consume failed:', consumeError)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  const session = issueStudentSession(email)
  const res = NextResponse.json({ ok: true, email })
  res.cookies.set(STUDENT_COOKIE_NAME, session.value, {
    ...STUDENT_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  })
  return res
}
