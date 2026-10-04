import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/admin/capacity-overflows
// Returns every unresolved paid-but-full case so the admin overview banner
// can list them. Rows get resolved via the per-id PATCH below.
export function GET(req: NextRequest) {
  return guarded(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('capacity_overflows')
      .select('*, session:class_sessions(*, class:classes(*))')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[ADMIN_CAPACITY_OVERFLOWS_GET]', error)
      return NextResponse.json({ error: 'Failed to load capacity overflows' }, { status: 500 })
    }
    return NextResponse.json({ overflows: data ?? [] })
  })
}
