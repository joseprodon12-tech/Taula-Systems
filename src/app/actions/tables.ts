'use server'

import { revalidatePath } from 'next/cache'
import { getAuthRestaurant } from '@/lib/auth'
import type { Table } from '@/db/schema'

export async function getTables(restaurantId: string): Promise<Table[]> {
  const { supabase } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('sort_order')
    .order('section')
  if (error) throw error
  return data as Table[]
}

export async function createTable(restaurantId: string, data: {
  number: string
  section: 'indoor' | 'outdoor'
  capacity: number
}): Promise<{ id: string } | { error: string }> {
  if (!data.number.trim()) return { error: 'El número de taula és obligatori' }

  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { data: existing } = await supabase
    .from('tables')
    .select('sort_order')
    .eq('restaurant_id', restaurantId)

  const maxOrder = (existing || []).reduce((m: number, t: { sort_order: number }) => Math.max(m, t.sort_order), -1)

  const { data: newTable, error } = await supabase.from('tables').insert({
    restaurant_id: restaurantId,
    number: data.number.trim(),
    section: data.section,
    capacity: data.capacity,
    sort_order: maxOrder + 1,
  }).select('id').single()

  if (error) return { error: 'Error en crear la taula' }
  revalidatePath('/config')
  return { id: newTable.id }
}

export async function updateTable(id: string, data: {
  number: string
  section: 'indoor' | 'outdoor'
  capacity: number
}): Promise<{ ok: true } | { error: string }> {
  if (!data.number.trim()) return { error: 'El número de taula és obligatori' }

  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase.from('tables').update({
    number: data.number.trim(),
    section: data.section,
    capacity: data.capacity,
  }).eq('id', id)

  if (error) return { error: 'Error en actualitzar la taula' }
  revalidatePath('/config')
  return { ok: true }
}

export async function deleteTable(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase.from('tables').delete().eq('id', id)
  if (error) return { error: 'Error en eliminar la taula' }
  revalidatePath('/config')
  return { ok: true }
}
