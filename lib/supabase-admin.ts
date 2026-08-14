import 'server-only'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error(
    'supabase-admin: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
  )
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
