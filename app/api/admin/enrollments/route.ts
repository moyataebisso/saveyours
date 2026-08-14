import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_ENROLLMENTS_LIMIT } from '@/lib/admin-limits'

export function GET(req: NextRequest) {
  return guarded(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('enrollments')
      .select('*, session:class_sessions(*, class:classes(*))')
      .order('enrolled_at', { ascending: false })
      .limit(ADMIN_ENROLLMENTS_LIMIT)

    if (error) {
      console.error('[ADMIN_ENROLLMENTS_GET]', error)
      return NextResponse.json({ error: 'Failed to load enrollments' }, { status: 500 })
    }
    return NextResponse.json({ enrollments: data ?? [], limit: ADMIN_ENROLLMENTS_LIMIT })
  })
}
