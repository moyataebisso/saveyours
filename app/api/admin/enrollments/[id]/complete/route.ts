import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_REGEX } from '@/lib/admin-limits'

// POST /api/admin/enrollments/[id]/complete
// Refuses to mark a cancelled enrollment complete — same guard the pre-
// refactor client had, but now enforced server-side where it belongs.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return guarded(req, async () => {
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid enrollment id' }, { status: 400 })
    }

    const { data: existing, error: readErr } = await supabaseAdmin
      .from('enrollments')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (readErr) {
      console.error('[ADMIN_ENROLLMENT_COMPLETE_READ]', readErr)
      return NextResponse.json({ error: 'Failed to read enrollment' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }
    if (existing.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot complete a cancelled enrollment' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .update({ status: 'completed', online_course_completed: true })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN_ENROLLMENT_COMPLETE_UPDATE]', error)
      return NextResponse.json({ error: 'Failed to update enrollment' }, { status: 500 })
    }
    return NextResponse.json({ enrollment: data })
  })
}
