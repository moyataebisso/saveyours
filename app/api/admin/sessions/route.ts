import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_SESSIONS_LIMIT } from '@/lib/admin-limits'

// GET /api/admin/sessions
// Optional: ?status=scheduled  or  ?status=scheduled,full
export function GET(req: NextRequest) {
  return guarded(req, async () => {
    const url = new URL(req.url)
    const statusParam = url.searchParams.get('status')
    const statuses = statusParam
      ? statusParam
          .split(',')
          .map((s) => s.trim())
          .filter((s) => ['scheduled', 'full', 'cancelled'].includes(s))
      : null

    let query = supabaseAdmin
      .from('class_sessions')
      .select('*, class:classes(*)')
      .order('date', { ascending: true })
      .limit(ADMIN_SESSIONS_LIMIT)

    if (statuses && statuses.length > 0) {
      query = query.in('status', statuses)
    }

    const { data, error } = await query
    if (error) {
      console.error('[ADMIN_SESSIONS_GET]', error)
      return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 })
    }
    return NextResponse.json({ sessions: data ?? [] })
  })
}

// POST /api/admin/sessions
// body: { class_id, date, start_time, end_time, location?, max_capacity? }
export function POST(req: NextRequest) {
  return guarded(req, async () => {
    const body = await req.json().catch(() => ({}))
    const {
      class_id,
      date,
      start_time,
      end_time,
      location,
      max_capacity,
    } = body ?? {}

    if (!class_id || !date || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (typeof class_id !== 'string' || typeof date !== 'string') {
      return NextResponse.json({ error: 'Invalid field types' }, { status: 400 })
    }

    // Preserve the same date-normalization the previous helper did.
    const dateOnly = String(date).split('T')[0]

    const { data, error } = await supabaseAdmin
      .from('class_sessions')
      .insert([{
        class_id,
        date: dateOnly,
        start_time,
        end_time,
        location: location ?? '10800 Lyndale Ave S Suite 310, Bloomington, MN 55420',
        max_capacity: typeof max_capacity === 'number' ? max_capacity : 12,
        status: 'scheduled',
        current_enrollment: 0,
      }])
      .select()
      .single()

    if (error) {
      console.error('[ADMIN_SESSIONS_POST]', error)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }
    return NextResponse.json({ session: data })
  })
}
