'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAvailableSlots } from '@/lib/schedule'
import type { Reservation, Restaurant } from '@/db/schema'

async function getAuthRestaurant() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('No autenticat')

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (error) throw error
  return { supabase, restaurant: restaurant as Restaurant }
}

export async function getReservationsForDay(restaurantId: string, date: string): Promise<Reservation[]> {
  const { supabase } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('date', date)
    .order('time')
    .order('created_at')
  if (error) throw error
  return data as Reservation[]
}

export async function updateReservationStatus(
  id: string,
  status: 'pending' | 'arrived' | 'no_show' | 'cancelled',
) {
  const { supabase } = await getAuthRestaurant()
  const { error } = await supabase
    .from('reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/avui')
}

export async function getReservationsForWeek(
  restaurantId: string,
  from: string,
  to: string,
): Promise<Record<string, Reservation[]>> {
  const { supabase } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('time')
  if (error) throw error

  const map: Record<string, Reservation[]> = {}
  for (const r of (data as Reservation[])) {
    if (!map[r.date]) map[r.date] = []
    map[r.date].push(r)
  }
  return map
}

export async function getCalendarDots(restaurantId: string, from: string, to: string) {
  const { supabase } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('reservations')
    .select('date, party_size, status')
    .eq('restaurant_id', restaurantId)
    .gte('date', from)
    .lte('date', to)
  if (error) throw error

  const map: Record<string, { count: number; pax: number }> = {}
  for (const r of (data as Pick<Reservation, 'date' | 'party_size' | 'status'>[])) {
    if (r.status === 'cancelled') continue
    if (!map[r.date]) map[r.date] = { count: 0, pax: 0 }
    map[r.date].count++
    map[r.date].pax += r.party_size
  }
  return map
}

export async function getAvailableSlotsForDate(date: string): Promise<string[]> {
  const { supabase, restaurant } = await getAuthRestaurant()

  const { data: closure } = await supabase
    .from('closures')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('date', date)
    .maybeSingle()

  if (closure) return []
  return getAvailableSlots(restaurant.weekly_hours, date)
}

export async function createReservation(data: {
  date: string
  time: string
  party_size: number
  section: 'indoor' | 'outdoor'
  customer_name: string
  customer_phone: string
  customer_email?: string
  notes?: string
  table_number?: string
  duration_minutes?: number
}): Promise<{ id: string; warning?: string } | { error: string; fieldErrors?: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {}
  if (!data.customer_name.trim()) fieldErrors.customer_name = 'El nom és obligatori'
  if (!data.date) fieldErrors.date = 'La data és obligatòria'
  if (!data.time) fieldErrors.time = "L'hora és obligatòria"
  if (Object.keys(fieldErrors).length) return { error: 'Comprova els camps obligatoris', fieldErrors }

  const { supabase, restaurant } = await getAuthRestaurant()

  // Check for table overlap before inserting
  if (data.table_number) {
    const hour = parseInt(data.time.split(':')[0])
    const isLunchSlot = hour >= 12 && hour < 17
    const resolvedDuration = data.duration_minutes
      ?? (isLunchSlot ? restaurant.default_duration_lunch_min : restaurant.default_duration_dinner_min)

    const { data: tableConflicts } = await supabase
      .from('reservations')
      .select('time, duration_minutes')
      .eq('restaurant_id', restaurant.id)
      .eq('date', data.date)
      .eq('table_number', data.table_number)
      .in('status', ['pending', 'arrived', 'standby'])

    if (tableConflicts && tableConflicts.length > 0) {
      const [rh, rm] = data.time.split(':').map(Number)
      const rStart = rh * 60 + rm
      const rEnd = rStart + resolvedDuration
      const hasConflict = tableConflicts.some((c: { time: string; duration_minutes: number }) => {
        const [ch, cm] = c.time.split(':').map(Number)
        const cStart = ch * 60 + cm
        const cEnd = cStart + (c.duration_minutes || 90)
        return rStart < cEnd && rEnd > cStart
      })
      if (hasConflict) return {
        error: `La taula ${data.table_number} ja té una reserva en aquest horari`,
        fieldErrors: { table_number: 'Taula ocupada en aquest interval' },
      }
    }
  }

  const { data: occupied } = await supabase
    .from('reservations')
    .select('party_size')
    .eq('restaurant_id', restaurant.id)
    .eq('date', data.date)
    .eq('section', data.section)
    .in('status', ['pending', 'arrived'])

  const occupiedPax = (occupied || []).reduce((s: number, r: { party_size: number }) => s + r.party_size, 0)
  const capacity = data.section === 'indoor' ? restaurant.capacity_indoor : restaurant.capacity_outdoor
  const total = occupiedPax + data.party_size
  const sectionLabel = data.section === 'indoor' ? 'El menjador' : 'La terrassa'
  const warning = capacity > 0 && total > capacity
    ? `⚠️ ${sectionLabel} té ${occupiedPax}/${capacity} places ocupades — reserva guardada igualment`
    : undefined

  const hour = parseInt(data.time.split(':')[0])
  const isLunch = hour >= 12 && hour < 17
  const defaultDuration = isLunch
    ? restaurant.default_duration_lunch_min
    : restaurant.default_duration_dinner_min

  const { data: newRes, error } = await supabase.from('reservations').insert({
    restaurant_id: restaurant.id,
    date: data.date,
    time: data.time,
    party_size: data.party_size,
    section: data.section,
    duration_minutes: data.duration_minutes ?? defaultDuration,
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone.trim(),
    customer_email: data.customer_email?.trim() || null,
    notes: data.notes?.trim() || null,
    table_number: data.table_number?.trim() || null,
    status: 'pending',
    source: 'manual',
    allergies: [],
  }).select('id').single()

  if (error) return { error: 'Error en guardar la reserva' }

  revalidatePath('/avui')
  revalidatePath('/agenda')
  return { id: newRes.id, warning }
}

export async function updateReservation(
  id: string,
  data: {
    date: string
    time: string
    party_size: number
    section: 'indoor' | 'outdoor'
    customer_name: string
    customer_phone: string
    customer_email?: string
    notes?: string
    table_number?: string
    duration_minutes?: number
  },
): Promise<{ ok: true } | { error: string }> {
  if (!data.customer_name.trim() || !data.date || !data.time) {
    return { error: 'Comprova els camps obligatoris' }
  }

  const { supabase } = await getAuthRestaurant()
  const { error } = await supabase.from('reservations').update({
    date: data.date,
    time: data.time,
    party_size: data.party_size,
    section: data.section,
    duration_minutes: data.duration_minutes,
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone.trim(),
    customer_email: data.customer_email?.trim() || null,
    notes: data.notes?.trim() || null,
    table_number: data.table_number?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) return { error: 'Error en actualitzar la reserva' }

  revalidatePath('/avui')
  revalidatePath('/agenda')
  revalidatePath('/reserva/' + id)
  return { ok: true }
}

export async function cancelReservation(id: string): Promise<{ ok: true }> {
  const { supabase } = await getAuthRestaurant()
  await supabase.from('reservations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/avui')
  revalidatePath('/reserva/' + id)
  return { ok: true }
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  const { supabase } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Reservation
}

export async function moveReservation(
  id: string,
  tableId: string,
  newTime: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await getAuthRestaurant()

  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('number, section')
    .eq('id', tableId)
    .single()

  if (tableError || !table) return { error: 'Taula no trobada' }

  const { error } = await supabase
    .from('reservations')
    .update({
      time: newTime,
      table_number: table.number,
      section: table.section,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: 'Error en moure la reserva' }

  revalidatePath('/avui')
  revalidatePath('/agenda')
  return { ok: true }
}

export async function getOccupiedTableNumbers(
  restaurantId: string,
  date: string,
  time: string,
  durationMinutes: number,
  excludeReservationId?: string,
): Promise<string[]> {
  const { supabase } = await getAuthRestaurant()

  const { data } = await supabase
    .from('reservations')
    .select('id, table_number, time, duration_minutes')
    .eq('restaurant_id', restaurantId)
    .eq('date', date)
    .in('status', ['pending', 'arrived', 'standby'])
    .not('table_number', 'is', null)

  if (!data) return []

  const [rh, rm] = time.split(':').map(Number)
  const rStart = rh * 60 + rm
  const rEnd = rStart + durationMinutes

  return data
    .filter(r => {
      if (excludeReservationId && r.id === excludeReservationId) return false
      const [oh, om] = r.time.split(':').map(Number)
      const oStart = oh * 60 + om
      const oEnd = oStart + (r.duration_minutes || 90)
      return rStart < oEnd && rEnd > oStart
    })
    .map(r => r.table_number as string)
}
