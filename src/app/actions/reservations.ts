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
): Promise<{ ok: true } | { error: string }> {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { error } = await supabase
    .from('reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
  if (error) return { error: "No s'ha pogut desar l'estat. Torna-ho a provar." }
  revalidatePath('/avui')
  revalidatePath('/agenda')
  return { ok: true }
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

type Auth = Awaited<ReturnType<typeof getAuthRestaurant>>
type SaveError = { error: string; fieldErrors?: Record<string, string> }

async function isClosedDay({ supabase, restaurant }: Auth, date: string): Promise<boolean> {
  const { data: closure } = await supabase
    .from('closures')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('date', date)
    .maybeSingle()
  return !!closure || getAvailableSlots(restaurant.weekly_hours, date).length === 0
}

// La zona la mana la taula: si no coincideixen, el detall diu Terrassa i la graella la pinta a Sala
async function resolveTableSection(
  { supabase, restaurant }: Auth,
  tableNumber: string,
  section: 'indoor' | 'outdoor',
): Promise<{ section: 'indoor' | 'outdoor' } | SaveError> {
  const { data: tables, error } = await supabase
    .from('tables')
    .select('number, section')
    .eq('restaurant_id', restaurant.id)
  if (error) return { error: 'Error en comprovar la taula' }
  // Sense taules configurades, el número de taula és text lliure
  if (tables.length === 0) return { section }

  const sameNumber = (tables as { number: string; section: 'indoor' | 'outdoor' }[])
    .filter(t => t.number === tableNumber)
  if (sameNumber.length === 0) {
    const message = `La taula ${tableNumber} no existeix. Tria una taula de la llista.`
    return { error: message, fieldErrors: { table_number: message } }
  }
  const matches = sameNumber.length === 1 ? sameNumber : sameNumber.filter(t => t.section === section)
  if (matches.length !== 1) {
    const message = `Hi ha més d'una taula amb el número ${tableNumber}. Canvia'n el número a Configuració.`
    return { error: message, fieldErrors: { table_number: message } }
  }
  return { section: matches[0].section }
}

async function findTableConflict(
  { supabase, restaurant }: Auth,
  r: { date: string; time: string; duration: number; tableNumber: string; excludeId?: string },
): Promise<SaveError | null> {
  let query = supabase
    .from('reservations')
    .select('time, duration_minutes')
    .eq('restaurant_id', restaurant.id)
    .eq('date', r.date)
    .eq('table_number', r.tableNumber)
    .in('status', ['pending', 'arrived', 'standby'])
  if (r.excludeId) query = query.neq('id', r.excludeId)
  const { data, error } = await query
  if (error) return { error: 'Error en comprovar si la taula és lliure' }

  const [h, m] = r.time.split(':').map(Number)
  const start = h * 60 + m
  const end = start + r.duration
  for (const c of data as { time: string; duration_minutes: number }[]) {
    const [ch, cm] = c.time.split(':').map(Number)
    const cStart = ch * 60 + cm
    const cEnd = cStart + (c.duration_minutes || 90)
    if (start < cEnd && end > cStart) {
      const until = `${String(Math.floor(cEnd / 60)).padStart(2, '0')}:${String(cEnd % 60).padStart(2, '0')}`
      const message = `La taula ${r.tableNumber} està ocupada de ${c.time} a ${until}. Tria una altra taula o canvia l'hora.`
      return { error: message, fieldErrors: { table_number: message } }
    }
  }
  return null
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
}): Promise<{ id: string; warning?: string } | SaveError> {
  const fieldErrors: Record<string, string> = {}
  if (!data.customer_name.trim()) fieldErrors.customer_name = 'El nom és obligatori'
  if (!data.date) fieldErrors.date = 'La data és obligatòria'
  if (!data.time) fieldErrors.time = "L'hora és obligatòria"
  if (Object.keys(fieldErrors).length) return { error: 'Comprova els camps obligatoris', fieldErrors }

  const auth = await getAuthRestaurant()
  const { supabase, restaurant } = auth

  // El formulari ja ho impedeix, però el connector MCP no hi passa: la regla viu aquí
  if (await isClosedDay(auth, data.date)) {
    return { error: 'El restaurant és tancat aquest dia', fieldErrors: { date: 'Dia tancat' } }
  }

  const hour = parseInt(data.time.split(':')[0])
  const isLunch = hour >= 12 && hour < 17
  const duration = data.duration_minutes
    ?? (isLunch ? restaurant.default_duration_lunch_min : restaurant.default_duration_dinner_min)

  const tableNumber = data.table_number?.trim() || null
  let section = data.section
  if (tableNumber) {
    const resolved = await resolveTableSection(auth, tableNumber, data.section)
    if ('error' in resolved) return resolved
    section = resolved.section
    const conflict = await findTableConflict(auth, { date: data.date, time: data.time, duration, tableNumber })
    if (conflict) return conflict
  }

  const { data: occupied } = await supabase
    .from('reservations')
    .select('party_size')
    .eq('restaurant_id', restaurant.id)
    .eq('date', data.date)
    .eq('section', section)
    .in('status', ['pending', 'arrived'])

  const occupiedPax = (occupied || []).reduce((s: number, r: { party_size: number }) => s + r.party_size, 0)
  const capacity = section === 'indoor' ? restaurant.capacity_indoor : restaurant.capacity_outdoor
  const total = occupiedPax + data.party_size
  const sectionLabel = section === 'indoor' ? 'El menjador' : 'La terrassa'
  const warning = capacity > 0 && total > capacity
    ? `⚠️ ${sectionLabel} té ${occupiedPax}/${capacity} places ocupades — reserva guardada igualment`
    : undefined

  const { data: newRes, error } = await supabase.from('reservations').insert({
    restaurant_id: restaurant.id,
    date: data.date,
    time: data.time,
    party_size: data.party_size,
    section,
    duration_minutes: duration,
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone.trim(),
    customer_email: data.customer_email?.trim() || null,
    notes: data.notes?.trim() || null,
    table_number: tableNumber,
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
): Promise<{ ok: true } | SaveError> {
  if (!data.customer_name.trim() || !data.date || !data.time) {
    return { error: 'Comprova els camps obligatoris' }
  }

  const auth = await getAuthRestaurant()
  const { supabase, restaurant } = auth

  const { data: current } = await supabase
    .from('reservations')
    .select('date, time, duration_minutes, section, table_number')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()
  if (!current) return { error: 'Reserva no trobada' }

  // Si el dia s'ha tancat després de reservar, s'ha de poder seguir editant el telèfon o les notes
  if (data.date !== current.date && await isClosedDay(auth, data.date)) {
    return { error: 'El restaurant és tancat aquest dia', fieldErrors: { date: 'Dia tancat' } }
  }

  const duration = data.duration_minutes ?? current.duration_minutes
  const tableNumber = data.table_number?.trim() || null
  let section = data.section
  // Només es valida si canvia on o quan seu el client: un solapament antic no ha de bloquejar editar les notes
  const changesSeat = data.date !== current.date || data.time !== current.time
    || duration !== current.duration_minutes || tableNumber !== current.table_number
    || data.section !== current.section
  if (tableNumber && changesSeat) {
    const resolved = await resolveTableSection(auth, tableNumber, data.section)
    if ('error' in resolved) return resolved
    section = resolved.section
    const conflict = await findTableConflict(auth, { date: data.date, time: data.time, duration, tableNumber, excludeId: id })
    if (conflict) return conflict
  }

  const { error } = await supabase.from('reservations').update({
    date: data.date,
    time: data.time,
    party_size: data.party_size,
    section,
    duration_minutes: duration,
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone.trim(),
    customer_email: data.customer_email?.trim() || null,
    notes: data.notes?.trim() || null,
    table_number: tableNumber,
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

export async function cancelReservation(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { error } = await supabase.from('reservations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
  if (error) return { error: "No s'ha pogut cancel·lar la reserva. Torna-ho a provar." }
  revalidatePath('/avui')
  revalidatePath('/agenda')
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

export async function getCustomerHistory(phone: string, beforeDate?: string): Promise<{
  visits: number
  lastDate: string
  recentNote: string | null
} | null> {
  if (!phone.trim()) return null
  const { supabase, restaurant } = await getAuthRestaurant()
  let query = supabase
    .from('reservations')
    .select('date, notes')
    .eq('restaurant_id', restaurant.id)
    .eq('customer_phone', phone.trim())
    .neq('status', 'cancelled')
  // Només compten com a visites anteriors les d'abans del dia de la reserva: la mateixa no és un antecedent
  if (beforeDate) query = query.lt('date', beforeDate)
  const { data } = await query.order('date', { ascending: false })
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
