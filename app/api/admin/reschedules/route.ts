import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/admin/reschedules
// Returns every reschedule_requests row (newest first) joined with enrollment
// student fields and both the from/to sessions. Used by the admin Reschedules
// tab and the "Rescheduled from <date>" badge on the Enrollments tab.
export function GET(req: NextRequest) {
  return guarded(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('reschedule_requests')
      .select(
        `id, enrollment_id, from_session_id, to_session_id, fee_amount, status, created_at, completed_at, stripe_payment_intent_id,
         enrollment:enrollments(id, guest_name, guest_email),
         from_session:class_sessions!reschedule_requests_from_session_id_fkey(id, date, start_time, class:classes(name)),
         to_session:class_sessions!reschedule_requests_to_session_id_fkey(id, date, start_time, class:classes(name))`
      )
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      // Common cause here would be the FK alias names not matching the DB.
      // Fall back to the plain select without the from/to joins so the tab
      // still renders rather than 500ing the whole dashboard.
      console.error('[ADMIN_RESCHEDULES_GET]', error)
      const fallback = await supabaseAdmin
        .from('reschedule_requests')
        .select(
          'id, enrollment_id, from_session_id, to_session_id, fee_amount, status, created_at, completed_at, stripe_payment_intent_id, enrollment:enrollments(id, guest_name, guest_email)'
        )
        .order('created_at', { ascending: false })
        .limit(200)
      if (fallback.error) {
        return NextResponse.json({ error: 'Failed to load reschedules' }, { status: 500 })
      }
      return NextResponse.json({ reschedules: fallback.data ?? [] })
    }
    return NextResponse.json({ reschedules: data ?? [] })
  })
}
