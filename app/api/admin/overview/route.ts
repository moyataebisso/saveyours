import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  ADMIN_ENROLLMENTS_LIMIT,
  ADMIN_INQUIRIES_LIMIT,
  ADMIN_SESSIONS_LIMIT,
} from '@/lib/admin-limits'

interface DashboardStats {
  totalEnrollments: number
  totalRevenue: number
  activeClassRevenue: number
  upcomingSessions: number
  newInquiries: number
}

// Aggregated dashboard load. Every stat is computed inside admin_dashboard_stats()
// (a Postgres function — see the SQL migration accompanying this route) because
// PostgREST rejects .select('col.sum()') aggregation at the server level with
// PGRST123 "Use of aggregate functions is not allowed".
//
// Granular refresh endpoints exist for post-mutation reloads — this route is
// for mount only.
export function GET(req: NextRequest) {
  return guarded(req, async () => {
    const [
      statsRes,
      sessionsRes,
      classesRes,
      enrollmentsRes,
      inquiriesRes,
    ] = await Promise.all([
      supabaseAdmin.rpc('admin_dashboard_stats'),
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
    ])

    // If ANY query failed, refuse to return a partial payload. The client
    // must never see a mix of real lists and zeroed stats (or vice versa)
    // — that would make Meea think her business had no revenue.
    const errors: { source: string; error: unknown }[] = []
    if (statsRes.error) errors.push({ source: 'stats', error: statsRes.error })
    if (sessionsRes.error) errors.push({ source: 'sessions', error: sessionsRes.error })
    if (classesRes.error) errors.push({ source: 'classes', error: classesRes.error })
    if (enrollmentsRes.error) errors.push({ source: 'enrollments', error: enrollmentsRes.error })
    if (inquiriesRes.error) errors.push({ source: 'inquiries', error: inquiriesRes.error })

    if (errors.length > 0) {
      for (const e of errors) {
        console.error(`[ADMIN_OVERVIEW] ${e.source} query error:`, e.error)
      }
      return NextResponse.json(
        { error: 'Failed to load overview', sources: errors.map((e) => e.source) },
        { status: 500 }
      )
    }

    // PostgREST serializes Postgres `numeric` as a JSON string to preserve
    // precision. sum(amount_paid) is numeric — so totalRevenue and
    // activeClassRevenue arrive here as strings like "1234.56". Coerce every
    // stat to a JS number before returning, and refuse to serve the response
    // if ANY of the five is not a finite number. Prevents "$1234.56" (string
    // toLocaleString is a no-op) rendering in the dashboard.
    const rawStats = statsRes.data as Record<string, unknown> | null
    if (!rawStats || typeof rawStats !== 'object') {
      console.error('[ADMIN_OVERVIEW] stats RPC returned null or non-object:', statsRes.data)
      return NextResponse.json({ error: 'Stats query returned unexpected shape' }, { status: 500 })
    }

    const toFiniteNumber = (v: unknown): number => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
      if (typeof v === 'string') {
        const n = Number(v)
        return Number.isFinite(n) ? n : NaN
      }
      return NaN
    }

    const stats: DashboardStats = {
      totalEnrollments: toFiniteNumber(rawStats.totalEnrollments),
      totalRevenue: toFiniteNumber(rawStats.totalRevenue),
      activeClassRevenue: toFiniteNumber(rawStats.activeClassRevenue),
      upcomingSessions: toFiniteNumber(rawStats.upcomingSessions),
      newInquiries: toFiniteNumber(rawStats.newInquiries),
    }

    for (const [k, v] of Object.entries(stats)) {
      if (!Number.isFinite(v)) {
        console.error(`[ADMIN_OVERVIEW] stats field "${k}" is not a finite number:`, rawStats[k], 'raw payload:', rawStats)
        return NextResponse.json(
          { error: `Stats field "${k}" was not a finite number` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      stats,
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
