import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_REGEX } from '@/lib/admin-limits'

const ALLOWED_FIELDS = new Set([
  'class_id',
  'date',
  'start_time',
  'end_time',
  'location',
  'max_capacity',
  'status',
])

// PATCH /api/admin/sessions/[id]
// Whitelist-validated update. The pre-refactor helper also flipped a full
// session back to 'scheduled' if capacity was raised — client sends
// status in the same request now, so no server-side inference needed.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return guarded(req, async () => {
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(k)) updates[k] = v
    }
    if (typeof updates.date === 'string') {
      updates.date = updates.date.split('T')[0]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('class_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN_SESSION_PATCH]', error)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }
    return NextResponse.json({ session: data })
  })
}
