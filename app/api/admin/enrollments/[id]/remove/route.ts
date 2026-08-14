import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_REGEX } from '@/lib/admin-limits'

// POST /api/admin/enrollments/[id]/remove
// body: { sessionId }
// Cancels the enrollment and decrements class_sessions.current_enrollment.
// Flips a full session back to 'scheduled' when the newly-freed spot opens.
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
      console.error('[ADMIN_ENROLLMENT_REMOVE_READ]', sessionErr)
      return NextResponse.json({ error: 'Failed to read session' }, { status: 500 })
    }
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()

    if (error) {
      console.error('[ADMIN_ENROLLMENT_REMOVE_UPDATE]', error)
      return NextResponse.json({ error: 'Failed to remove enrollment' }, { status: 500 })
    }

    const newCount = Math.max(0, session.current_enrollment - 1)
    const newStatus = newCount < session.max_capacity ? 'scheduled' : 'full'
    const { error: sessionUpdateErr } = await supabaseAdmin
      .from('class_sessions')
      .update({ current_enrollment: newCount, status: newStatus })
      .eq('id', sessionId)

    if (sessionUpdateErr) {
      console.error('[ADMIN_ENROLLMENT_REMOVE_COUNT]', sessionUpdateErr)
    }

    return NextResponse.json({ enrollment: data?.[0] ?? null })
  })
}
