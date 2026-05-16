import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Customer = {
  id: string
  name: string
  phone: string
  email: string
  policy_type: string
  policy_start_date: string
  policy_due_date: string
  notes: string
  created_at: string
}
