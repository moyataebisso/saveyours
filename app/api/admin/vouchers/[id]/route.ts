import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UUID_REGEX } from '@/lib/admin-limits'

const ALLOWED_FIELDS = new Set([
  'voucher_url',
  'status',
  'assigned_to_email',
  'assigned_at',
])
const ALLOWED_STATUS = new Set(['available', 'assigned'])

// PATCH /api/admin/vouchers/[id]
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return guarded(req, async () => {
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid voucher id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(k)) updates[k] = v
    }
    if (typeof updates.status === 'string' && !ALLOWED_STATUS.has(updates.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (
      typeof updates.voucher_url === 'string' &&
      (updates.voucher_url.length === 0 || updates.voucher_url.length > 2000)
    ) {
      return NextResponse.json({ error: 'Invalid voucher_url' }, { status: 400 })
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('voucher_links')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN_VOUCHER_PATCH]', error)
      return NextResponse.json({ error: 'Failed to update voucher' }, { status: 500 })
    }
    return NextResponse.json({ voucher: data })
  })
}

// DELETE /api/admin/vouchers/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return guarded(req, async () => {
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid voucher id' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('voucher_links')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[ADMIN_VOUCHER_DELETE]', error)
      return NextResponse.json({ error: 'Failed to delete voucher' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  })
}
