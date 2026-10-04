import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_REGEX } from '@/lib/admin-limits'

// PATCH /api/admin/capacity-overflows/[id]
// body: { resolved: boolean }
// Flips an overflow row's `resolved` flag. The banner on the overview tab
// disappears when the last unresolved row is marked.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return guarded(req, async () => {
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid overflow id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || typeof (body as { resolved?: unknown }).resolved !== 'boolean') {
      return NextResponse.json({ error: 'Body must include resolved: boolean' }, { status: 400 })
    }
    const resolved = (body as { resolved: boolean }).resolved

    const { data, error } = await supabaseAdmin
      .from('capacity_overflows')
      .update({ resolved })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN_CAPACITY_OVERFLOW_PATCH]', error)
      return NextResponse.json({ error: 'Failed to update overflow' }, { status: 500 })
    }
    return NextResponse.json({ overflow: data })
  })
}
