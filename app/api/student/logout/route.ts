import { NextResponse } from 'next/server'
import { STUDENT_COOKIE_NAME, STUDENT_COOKIE_OPTIONS } from '@/lib/student-auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(STUDENT_COOKIE_NAME, '', { ...STUDENT_COOKIE_OPTIONS, maxAge: 0 })
  return res
}
