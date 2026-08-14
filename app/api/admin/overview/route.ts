import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  ADMIN_ENROLLMENTS_LIMIT,
  ADMIN_INQUIRIES_LIMIT,
  ADMIN_SESSIONS_LIMIT,
} from '@/lib/admin-limits'

// Aggregated dashboard load. One round-trip that returns every list the
// admin page needs to render plus SQL-computed stats. Granular refresh
// endpoints exist for post-mutation reloads — this route is for mount only.
export function GET(req: NextRequest) {
  return guarded(req, async () => {
    // Local YYYY-MM-DD, not toISOString (UTC would flip the day after ~7pm
    // Central — known off-by-one bug documented in app/admin/page.tsx).
    const now = new Date()
    const todayStr =
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, '0')}-` +
      `${String(now.getDate()).padStart(2, '0')}`

    // Every stat is a discrete server-side query. The revenue sums use
    // PostgREST's .sum() aggregate so we never pull row-level amount_paid
    // data across the wire just to add it up.
    const [
      sessionsRes,
      classesRes,
      enrollmentsRes,
      inquiriesRes,
      totalEnrollmentsCountRes,
      totalRevenueRes,
      activeSessionIdRes,
      upcomingSessionsCountRes,
      newInquiriesCountRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('class_sessions')
        .select('*, class:classes(*)')
        .order('date', { ascending: true })
        .limit(ADMIN_SESSIONS_LIMIT),
      supabaseAdmin.from('classes').select('*'),
      supabaseAdmin
        .from('enrollments')
        .select('*, session:class_sessions(*, class:classes(*))')
        .order('enrolled_at', { ascending: false })
        .limit(ADMIN_ENROLLMENTS_LIMIT),
      supabaseAdmin
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(ADMIN_INQUIRIES_LIMIT),
      supabaseAdmin
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'paid'),
      supabaseAdmin
        .from('enrollments')
        .select('amount_paid.sum()')
        .eq('payment_status', 'paid'),
      supabaseAdmin
        .from('class_sessions')
        .select('id')
        .gte('date', todayStr)
        .neq('status', 'cancelled'),
      supabaseAdmin
        .from('class_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('date', todayStr)
        .eq('status', 'scheduled'),
      supabaseAdmin
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new'),
    ])

    for (const r of [
      sessionsRes,
      classesRes,
      enrollmentsRes,
      inquiriesRes,
      totalRevenueRes,
      activeSessionIdRes,
    ]) {
      if (r.error) {
        console.error('[ADMIN_OVERVIEW] Query error:', r.error)
        return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 })
      }
    }

    // Active-class revenue: sum only over enrollments whose session is
    // both upcoming and not cancelled. Requires the list of active session
    // ids first, then a second aggregation filtered by .in().
    const activeIds = (activeSessionIdRes.data ?? []).map((s) => s.id)
    let activeClassRevenue = 0
    if (activeIds.length > 0) {
      const { data: activeRevData, error: activeRevErr } = await supabaseAdmin
        .from('enrollments')
        .select('amount_paid.sum()')
        .eq('payment_status', 'paid')
        .neq('status', 'cancelled')
        .in('session_id', activeIds)
      if (activeRevErr) {
        console.error('[ADMIN_OVERVIEW] Active revenue query error:', activeRevErr)
        return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 })
      }
      const firstRow = Array.isArray(activeRevData) ? activeRevData[0] : null
      activeClassRevenue = Number(firstRow?.sum ?? 0)
    }

    const totalRevenueRow = Array.isArray(totalRevenueRes.data) ? totalRevenueRes.data[0] : null
    const totalRevenue = Number(totalRevenueRow?.sum ?? 0)

    return NextResponse.json({
      stats: {
        totalEnrollments: totalEnrollmentsCountRes.count ?? 0,
        totalRevenue,
        activeClassRevenue,
        upcomingSessions: upcomingSessionsCountRes.count ?? 0,
        newInquiries: newInquiriesCountRes.count ?? 0,
      },
      sessions: sessionsRes.data ?? [],
      classes: classesRes.data ?? [],
      enrollments: enrollmentsRes.data ?? [],
      inquiries: inquiriesRes.data ?? [],
      limits: {
        enrollments: ADMIN_ENROLLMENTS_LIMIT,
        inquiries: ADMIN_INQUIRIES_LIMIT,
        sessions: ADMIN_SESSIONS_LIMIT,
      },
    })
  })
}
