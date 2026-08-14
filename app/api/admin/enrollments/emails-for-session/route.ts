import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_REGEX } from '@/lib/admin-limits'

// GET /api/admin/enrollments/emails-for-session?sessionId=<uuid>
// Returns the set of non-cancelled guest_email values for a class_session.
// Used by the voucher-assignment safety check to warn Meea when she assigns
// a voucher to an email that has no enrollment in the class.
export function GET(req: NextRequest) {
  return guarded(req, async () => {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId') ?? ''
    if (!UUID_REGEX.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .select('guest_email')
      .eq('session_id', sessionId)
      .neq('status', 'cancelled')

    if (error) {
      console.error('[ADMIN_ENROLLMENT_EMAILS]', error)
      return NextResponse.json({ error: 'Failed to load emails' }, { status: 500 })
    }
    return NextResponse.json({ emails: (data ?? []).map((r) => r.guest_email) })
  })
}
