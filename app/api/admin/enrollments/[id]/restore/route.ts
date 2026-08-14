import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_REGEX } from '@/lib/admin-limits'

// POST /api/admin/enrollments/[id]/restore
// body: { sessionId }
// Restore a cancelled enrollment IF the session is still viable (not
// cancelled, has capacity). Bumps class_sessions.current_enrollment.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return guarded(req, async () => {
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid enrollment id' }, { status: 400 })
    }

    const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string }
    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }

    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('class_sessions')
      .select('current_enrollment, max_capacity, status')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionErr) {
      console.error('[ADMIN_ENROLLMENT_RESTORE_READ]', sessionErr)
      return NextResponse.json({ error: 'Failed to read session' }, { status: 500 })
    }
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot restore — session is cancelled' }, { status: 409 })
    }
    if (session.current_enrollment >= session.max_capacity) {
      return NextResponse.json({ error: 'Cannot restore — session is full' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .update({ status: 'confirmed' })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN_ENROLLMENT_RESTORE_UPDATE]', error)
      return NextResponse.json({ error: 'Failed to restore enrollment' }, { status: 500 })
    }

    const newCount = session.current_enrollment + 1
    const { error: sessionUpdateErr } = await supabaseAdmin
      .from('class_sessions')
      .update({
        current_enrollment: newCount,
        status: newCount >= session.max_capacity ? 'full' : 'scheduled',
      })
      .eq('id', sessionId)

    if (sessionUpdateErr) {
      console.error('[ADMIN_ENROLLMENT_RESTORE_COUNT]', sessionUpdateErr)
    }

    return NextResponse.json({ enrollment: data })
  })
}
