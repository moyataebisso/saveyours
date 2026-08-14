import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_VOUCHER_BULK_DELETE_LIMIT, UUID_REGEX } from '@/lib/admin-limits'

// POST /api/admin/vouchers/delete-batch
// body: { ids: string[] }
// Every id must be a valid UUID before the delete runs — reject the whole
// batch on the first malformed id rather than silently skipping it.
export function POST(req: NextRequest) {
  return guarded(req, async () => {
    const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
    }
    if (ids.length > ADMIN_VOUCHER_BULK_DELETE_LIMIT) {
      return NextResponse.json(
        { error: `Too many ids; max ${ADMIN_VOUCHER_BULK_DELETE_LIMIT} per request` },
        { status: 400 }
      )
    }
    for (const id of ids) {
      if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
        return NextResponse.json({ error: 'Every id must be a valid UUID' }, { status: 400 })
      }
    }

    const { error } = await supabaseAdmin
      .from('voucher_links')
      .delete()
      .in('id', ids as string[])

    if (error) {
      console.error('[ADMIN_VOUCHERS_DELETE_BATCH]', error)
      return NextResponse.json({ error: 'Failed to delete vouchers' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, deletedCount: ids.length })
  })
}
