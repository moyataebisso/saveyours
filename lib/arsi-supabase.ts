import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.ARSI_SUPABASE_URL || ''
const supabaseKey = process.env.ARSI_SUPABASE_SERVICE_KEY || ''

export const arsiSupabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder')
