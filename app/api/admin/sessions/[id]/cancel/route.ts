import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_REGEX } from '@/lib/admin-limits'

// POST /api/admin/sessions/[id]/cancel
// Cancels the class_session AND cascades to cancel every enrollment in it.
// Two writes; the enrollment cascade is best-effort — a failure there is
// logged but does not roll back the session cancellation (matches the
// pre-refactor client behavior which also did not roll back on cascade
// failure).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return guarded(req, async () => {
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('class_sessions')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()

    if (error) {
      console.error('[ADMIN_SESSION_CANCEL]', error)
      return NextResponse.json({ error: 'Failed to cancel session' }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { error: cascadeError } = await supabaseAdmin
      .from('enrollments')
      .update({ status: 'cancelled' })
      .eq('session_id', id)

    if (cascadeError) {
      console.error('[ADMIN_SESSION_CANCEL] Cascade error (non-fatal):', cascadeError)
    }

    return NextResponse.json({ session: data[0], cascadeError: cascadeError?.message ?? null })
  })
}
