import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client amb service role per a API routes (bypassa RLS)
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
  return createClient(supabaseUrl, serviceKey)
}

export type Restaurant = {
  id: string
  name: string
  slug: string
  phone: string
  email: string
  schedule: Record<string, { lunch?: string; dinner?: string } | null>
  max_capacity: number
  group_threshold: number
  whatsapp_number: string
  primary_color: string
  logo_url: string | null
  welcome_message: string | null
  address: string | null
  city: string | null
  created_at: string
}

export type Reservation = {
  id: string
  restaurant_id: string
  date: string
  time: string
  party_size: number
  name: string
  phone: string
  allergies: string[]
  special_occasion?: string
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: string
}

export type NewReservation = Omit<Reservation, 'id' | 'status' | 'created_at'>
