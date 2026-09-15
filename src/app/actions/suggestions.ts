'use server'

import { getAuthRestaurant } from '@/lib/auth'
import type { Suggestion } from '@/db/schema'

export async function createSuggestion(
  data: Pick<Suggestion, 'title' | 'what' | 'why' | 'area' | 'kind' | 'urgency'> & { example?: string },
): Promise<{ id: string } | { error: string; fieldErrors?: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {}
  if (!data.title.trim()) fieldErrors.title = 'El títol és obligatori'
  if (!data.what.trim()) fieldErrors.what = 'Cal explicar què es vol canviar'
  if (!data.why.trim()) fieldErrors.why = 'Cal explicar per què'
  if (Object.keys(fieldErrors).length) return { error: 'Comprova els camps obligatoris', fieldErrors }

  const { supabase, restaurant, user } = await getAuthRestaurant()
  const { data: row, error } = await supabase
    .from('suggestions')
    .insert({
      restaurant_id: restaurant.id,
      user_id: user.id,
      title: data.title.trim(),
      what: data.what.trim(),
      why: data.why.trim(),
      area: data.area,
      kind: data.kind,
      urgency: data.urgency,
      example: data.example?.trim() || null,
    })
    .select('id')
    .single()

  if (error) return { error: 'Error en guardar el suggeriment' }
  return { id: row.id }
}

export async function getSuggestions(): Promise<Suggestion[]> {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Suggestion[]
}
