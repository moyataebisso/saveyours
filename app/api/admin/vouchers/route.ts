import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_VOUCHER_BULK_INSERT_LIMIT, UUID_REGEX } from '@/lib/admin-limits'

// GET /api/admin/vouchers?sessionId=<uuid>
export function GET(req: NextRequest) {
  return guarded(req, async () => {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId') ?? ''
    if (!UUID_REGEX.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('voucher_links')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[ADMIN_VOUCHERS_GET]', error)
      return NextResponse.json({ error: 'Failed to load vouchers' }, { status: 500 })
    }
    return NextResponse.json({ vouchers: data ?? [] })
  })
}

// POST /api/admin/vouchers
// body: { sessionId, urls: string[] }
export function POST(req: NextRequest) {
  return guarded(req, async () => {
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: string
      urls?: unknown
    }

    if (!body.sessionId || !UUID_REGEX.test(body.sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 })
    }
    if (!Array.isArray(body.urls) || body.urls.length === 0) {
      return NextResponse.json({ error: 'urls must be a non-empty array' }, { status: 400 })
    }
    if (body.urls.length > ADMIN_VOUCHER_BULK_INSERT_LIMIT) {
      return NextResponse.json(
        { error: `Too many vouchers; max ${ADMIN_VOUCHER_BULK_INSERT_LIMIT} per request` },
        { status: 400 }
      )
    }

    const trimmed: string[] = []
    for (const u of body.urls) {
      if (typeof u !== 'string') continue
      const s = u.trim()
      if (s.length === 0 || s.length > 2000) continue
      trimmed.push(s)
    }
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'No valid URLs provided' }, { status: 400 })
    }

    const rows = trimmed.map((url) => ({
      session_id: body.sessionId,
      voucher_url: url,
      status: 'available' as const,
    }))

    const { data, error } = await supabaseAdmin
      .from('voucher_links')
      .insert(rows)
      .select()

    if (error) {
      console.error('[ADMIN_VOUCHERS_POST]', error)
      return NextResponse.json({ error: 'Failed to add vouchers' }, { status: 500 })
    }
    return NextResponse.json({ vouchers: data ?? [] })
  })
}
