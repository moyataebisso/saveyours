import { NextRequest, NextResponse } from 'next/server'
import { arsiSupabase } from '@/lib/arsi-supabase'
import { requireAdmin, AdminUnauthorizedError } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (e) {
    if (e instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw e
  }

  const { data, error } = await arsiSupabase
    .from('change_requests')
    .select('id, request_type, description, status, priority, admin_notes, created_at')
    .eq('client_email', 'admin@saveyours.net')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requests: data })
}
