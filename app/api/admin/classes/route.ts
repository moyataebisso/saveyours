import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export function GET(req: NextRequest) {
  return guarded(req, async () => {
    const { data, error } = await supabaseAdmin.from('classes').select('*')
    if (error) {
      console.error('[ADMIN_CLASSES_GET]', error)
      return NextResponse.json({ error: 'Failed to load classes' }, { status: 500 })
    }
    return NextResponse.json({ classes: data ?? [] })
  })
}
