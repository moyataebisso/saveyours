import { arsiSupabase } from '@/lib/arsi-supabase'

export async function GET() {
  const { data, error } = await arsiSupabase
    .from('change_requests')
    .select('id, request_type, description, status, priority, admin_notes, created_at')
    .eq('client_email', 'admin@saveyours.net')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ requests: data })
}
