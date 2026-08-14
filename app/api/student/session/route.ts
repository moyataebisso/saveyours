import { NextRequest, NextResponse } from 'next/server'
import { requireStudent, StudentUnauthorizedError } from '@/lib/student-auth'

// Lightweight probe for the client: is the current student_session cookie
// valid? Returns 200 with { email } if so, 401 otherwise. /dashboard calls
// this on mount to decide whether to show the OTP flow or the enrollments.
export async function GET(req: NextRequest) {
  try {
    const student = await requireStudent(req)
    return NextResponse.json({ ok: true, email: student.email })
  } catch (e) {
    if (e instanceof StudentUnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw e
  }
}
