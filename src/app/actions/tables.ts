'use server'

import { revalidatePath } from 'next/cache'
import { getAuthRestaurant } from '@/lib/auth'
import { todayISO } from '@/lib/dates'
import type { Table } from '@/db/schema'

export async function getTables(): Promise<Table[]> {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('sort_order')
    .order('section')
  if (error) throw error
  return data as Table[]
}

export async function createTable(data: {
  number: string
  section: 'indoor' | 'outdoor'
  capacity: number
}): Promise<{ id: string } | { error: string }> {
  const number = data.number.trim()
  if (!number) return { error: 'El número de taula és obligatori' }

  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { data: existing } = await supabase
    .from('tables')
    .select('number, sort_order')
    .eq('restaurant_id', restaurant.id)

  // Les reserves identifiquen la taula pel número: dues d'iguals farien ambigus els conflictes i la zona
  if ((existing || []).some((t: { number: string }) => t.number === number)) {
    return { error: `Ja hi ha una taula amb el número ${number}` }
  }

  const maxOrder = (existing || []).reduce((m: number, t: { sort_order: number }) => Math.max(m, t.sort_order), -1)

  const { data: newTable, error } = await supabase.from('tables').insert({
    restaurant_id: restaurant.id,
    number,
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
  const number = data.number.trim()
  if (!number) return { error: 'El número de taula és obligatori' }

  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const [{ data: current }, { data: sameNumber }] = await Promise.all([
    supabase.from('tables').select('number, section').eq('id', id).eq('restaurant_id', restaurant.id).maybeSingle(),
    supabase.from('tables').select('id').eq('restaurant_id', restaurant.id).eq('number', number).neq('id', id),
  ])
  if (!current) return { error: 'Taula no trobada' }
  if (sameNumber && sameNumber.length > 0) return { error: `Ja hi ha una taula amb el número ${number}` }

  const { error } = await supabase.from('tables').update({
    number,
    section: data.section,
    capacity: data.capacity,
  })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: 'Error en actualitzar la taula' }

  // Les reserves guarden el número i la zona: sense això apuntarien a una taula que ja no existeix.
  // Les passades es deixen com a historial.
  if (current.number !== number || current.section !== data.section) {
    const { error: resError } = await supabase.from('reservations')
      .update({ table_number: number, section: data.section, updated_at: new Date().toISOString() })
      .eq('restaurant_id', restaurant.id)
      .eq('table_number', current.number)
      .gte('date', todayISO())
      .in('status', ['pending', 'arrived', 'standby'])
    if (resError) return { error: "Taula desada, però no s'han pogut actualitzar les reserves que la tenen assignada" }
    revalidatePath('/avui')
    revalidatePath('/agenda')
  }

  revalidatePath('/config')
  return { ok: true }
}

export async function deleteTable(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { data: table } = await supabase
    .from('tables')
    .select('number')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .single()

  if (!table) return { error: 'Taula no trobada' }

  const { count } = await supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', table.number)
    .gte('date', todayISO())
    .in('status', ['pending', 'arrived', 'standby'])

  if (count && count > 0) return { error: 'Té reserves futures, no es pot eliminar' }

  const { error } = await supabase.from('tables').delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: 'Error en eliminar la taula' }
  revalidatePath('/config')
  return { ok: true }
}
