import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_REGEX } from '@/lib/admin-limits'

const ALLOWED_STATUS = new Set(['new', 'contacted', 'resolved'])

// PATCH /api/admin/inquiries/[id]
// body: { status: 'new' | 'contacted' | 'resolved' }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return guarded(req, async () => {
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid inquiry id' }, { status: 400 })
    }

    const { status } = (await req.json().catch(() => ({}))) as { status?: string }
    if (!status || !ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('inquiries')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN_INQUIRY_PATCH]', error)
      return NextResponse.json({ error: 'Failed to update inquiry' }, { status: 500 })
    }
    return NextResponse.json({ inquiry: data })
  })
}
