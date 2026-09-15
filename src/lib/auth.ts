import { AsyncLocalStorage } from 'node:async_hooks'
import { createClient as createTokenClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Restaurant } from '@/db/schema'

// Token OAuth de la petició MCP en curs. Les server actions criden
// getAuthRestaurant() tant des del panell com des del connector: amb aquest
// context actuen com l'usuari del token, amb les mateixes regles RLS i rol.
const accessTokenContext = new AsyncLocalStorage<string>()

export function runWithAccessToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
  return accessTokenContext.run(token, fn)
}

// Retorna sessió + restaurant + rol. Llença si no autenticat o sense restaurant assignat.
export async function getAuthRestaurant() {
  const token = accessTokenContext.getStore()
  const supabase: SupabaseClient = token
    ? createTokenClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      })
    : await createClient()

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error('No autenticat')

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('role, restaurant_id')
    .eq('user_id', user.id)
    .single()

  if (!member) throw new Error('Sense restaurant assignat')

  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', member.restaurant_id)
    .single()

  if (rErr || !restaurant) throw new Error('Restaurant no trobat')

  return {
    supabase,
    user,
    restaurant: restaurant as Restaurant,
    role: member.role as 'owner' | 'staff',
  }
}
