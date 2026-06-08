import { createClient } from '@/lib/supabase/server'
import type { Restaurant } from '@/db/schema'

// Retorna sessió + restaurant + rol. Llença si no autenticat o sense restaurant assignat.
export async function getAuthRestaurant() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
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
