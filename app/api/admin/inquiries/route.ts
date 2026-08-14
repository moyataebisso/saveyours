import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_INQUIRIES_LIMIT } from '@/lib/admin-limits'

export function GET(req: NextRequest) {
  return guarded(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(ADMIN_INQUIRIES_LIMIT)

    if (error) {
      console.error('[ADMIN_INQUIRIES_GET]', error)
      return NextResponse.json({ error: 'Failed to load inquiries' }, { status: 500 })
    }
    return NextResponse.json({ inquiries: data ?? [], limit: ADMIN_INQUIRIES_LIMIT })
  })
}
