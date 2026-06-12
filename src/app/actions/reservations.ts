'use server'

import { revalidatePath } from 'next/cache'
import { getAvailableSlots } from '@/lib/schedule'
import { getAuthRestaurant } from '@/lib/auth'
import { todayISO } from '@/lib/dates'
import type { Reservation } from '@/db/schema'

export async function getReservationsForDay(date: string): Promise<Reservation[]> {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('restaurant_id', restaurant.id)
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
  const { supabase, restaurant } = await getAuthRestaurant()
  const { error } = await supabase
    .from('reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
  if (error) throw error
  revalidatePath('/avui')
}

export async function getReservationsForWeek(
  from: string,
  to: string,
): Promise<Record<string, Reservation[]>> {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('restaurant_id', restaurant.id)
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

export async function getCalendarDots(from: string, to: string) {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('reservations')
    .select('date, party_size, status')
    .eq('restaurant_id', restaurant.id)
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

  const hour = parseInt(data.time.split(':')[0])
  const isLunch = hour >= 12 && hour < 17
  const duration = data.duration_minutes
    ?? (isLunch ? restaurant.default_duration_lunch_min : restaurant.default_duration_dinner_min)

  if (data.table_number) {
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
      const rEnd = rStart + duration
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

  const { data: newRes, error } = await supabase.from('reservations').insert({
    restaurant_id: restaurant.id,
    date: data.date,
    time: data.time,
    party_size: data.party_size,
    section: data.section,
    duration_minutes: duration,
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

  const { supabase, restaurant } = await getAuthRestaurant()
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
  })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: 'Error en actualitzar la reserva' }

  revalidatePath('/avui')
  revalidatePath('/agenda')
  revalidatePath('/reserva/' + id)
  return { ok: true }
}

export async function cancelReservation(id: string): Promise<{ ok: true }> {
  const { supabase, restaurant } = await getAuthRestaurant()
  await supabase.from('reservations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
  revalidatePath('/avui')
  revalidatePath('/reserva/' + id)
  return { ok: true }
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .single()
  if (error) return null
  return data as Reservation
}

export async function moveReservation(
  id: string,
  tableId: string,
  newTime: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase, restaurant } = await getAuthRestaurant()

  const [{ data: table, error: tableError }, { data: reservation }] = await Promise.all([
    supabase.from('tables').select('number, section').eq('id', tableId).eq('restaurant_id', restaurant.id).single(),
    supabase.from('reservations').select('date, duration_minutes').eq('id', id).eq('restaurant_id', restaurant.id).single(),
  ])

  if (tableError || !table) return { error: 'Taula no trobada' }
  if (!reservation) return { error: 'Reserva no trobada' }

  const hour = parseInt(newTime.split(':')[0])
  const isLunch = hour >= 12 && hour < 17
  const duration = reservation.duration_minutes
    ?? (isLunch ? restaurant.default_duration_lunch_min : restaurant.default_duration_dinner_min)

  const { data: conflicts } = await supabase
    .from('reservations')
    .select('time, duration_minutes')
    .eq('restaurant_id', restaurant.id)
    .eq('date', reservation.date)
    .eq('table_number', table.number)
    .in('status', ['pending', 'arrived', 'standby'])
    .neq('id', id)

  if (conflicts && conflicts.length > 0) {
    const [rh, rm] = newTime.split(':').map(Number)
    const rStart = rh * 60 + rm
    const rEnd = rStart + duration
    const hasConflict = conflicts.some((c: { time: string; duration_minutes: number }) => {
      const [ch, cm] = c.time.split(':').map(Number)
      const cStart = ch * 60 + cm
      const cEnd = cStart + (c.duration_minutes || 90)
      return rStart < cEnd && rEnd > cStart
    })
    if (hasConflict) return { error: `La taula ${table.number} ja té una reserva en aquest horari` }
  }

  const { error } = await supabase
    .from('reservations')
    .update({
      time: newTime,
      table_number: table.number,
      section: table.section,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: 'Error en moure la reserva' }

  revalidatePath('/avui')
  revalidatePath('/agenda')
  return { ok: true }
}

export async function getCustomerHistory(phone: string): Promise<{
  visits: number
  lastDate: string
  recentNote: string | null
} | null> {
  if (!phone.trim()) return null
  const { supabase, restaurant } = await getAuthRestaurant()
  const { data } = await supabase
    .from('reservations')
    .select('date, notes')
    .eq('restaurant_id', restaurant.id)
    .eq('customer_phone', phone.trim())
    .neq('status', 'cancelled')
    .order('date', { ascending: false })
  if (!data || data.length === 0) return null
  return {
    visits: data.length,
    lastDate: data[0].date,
    recentNote: data.find(r => r.notes)?.notes ?? null,
  }
}

export async function getOccupiedTableNumbers(
  date: string,
  time: string,
  durationMinutes: number,
  excludeReservationId?: string,
): Promise<string[]> {
  const { supabase, restaurant } = await getAuthRestaurant()

  const { data } = await supabase
    .from('reservations')
    .select('id, table_number, time, duration_minutes')
    .eq('restaurant_id', restaurant.id)
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
