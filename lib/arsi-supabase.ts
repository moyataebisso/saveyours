import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.ARSI_SUPABASE_URL
const supabaseKey = process.env.ARSI_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'arsi-supabase: ARSI_SUPABASE_URL and ARSI_SUPABASE_SERVICE_KEY must be set'
  )
}

export const arsiSupabase = createClient(supabaseUrl, supabaseKey)
