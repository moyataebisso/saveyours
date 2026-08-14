import { NextRequest, NextResponse } from 'next/server'
import { guardedStudent } from '@/lib/student-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Reads enrollments for the email in the session cookie ONLY. Never
// accepts an email from the request — the whole point of the OTP flow is
// that we can only serve verified-owner data. Any email input on this
// route would defeat the design.
//
// Enrollments are stored lowercase by /api/enrollment/create going forward;
// historical rows were lowercased by the schema migration. .eq() is exact
// match, so any stragglers with mixed case will not appear — the migration
// UPDATE fixes that.
export function GET(req: NextRequest) {
  return guardedStudent(req, async (student) => {
    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .select('*, session:class_sessions(*, class:classes(*))')
      .eq('guest_email', student.email)
      .order('enrolled_at', { ascending: false })

    if (error) {
      console.error('[STUDENT_ENROLLMENTS]', error)
      return NextResponse.json({ error: 'Failed to load enrollments' }, { status: 500 })
    }

    return NextResponse.json({ enrollments: data ?? [] })
  })
}
