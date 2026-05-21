'use server'

import { db } from '@/db'
import { reservations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getAvailableSlots } from '@/lib/schedule'
import type { Reservation } from '@/db/schema'

export async function getReservationsForDay(restaurantId: string, date: string): Promise<Reservation[]> {
  return db.query.reservations.findMany({
    where: (r, { eq, and }) => and(
      eq(r.restaurant_id, restaurantId),
      eq(r.date, date),
    ),
    orderBy: (r, { asc }) => [asc(r.time), asc(r.created_at)],
  })
}

export async function updateReservationStatus(
  id: string,
  status: 'pending' | 'arrived' | 'no_show' | 'cancelled',
) {
  await db.update(reservations)
    .set({ status, updated_at: new Date().toISOString() })
    .where(eq(reservations.id, id))
  revalidatePath('/avui')
}

export async function getReservationsForWeek(
  restaurantId: string,
  from: string,
  to: string,
): Promise<Record<string, Reservation[]>> {
  const rows = await db.query.reservations.findMany({
    where: (r, { and, eq, gte, lte }) => and(
      eq(r.restaurant_id, restaurantId),
      gte(r.date, from),
      lte(r.date, to),
    ),
    orderBy: (r, { asc }) => [asc(r.date), asc(r.time)],
  })
  const map: Record<string, Reservation[]> = {}
  for (const r of rows) {
    if (!map[r.date]) map[r.date] = []
    map[r.date].push(r)
  }
  return map
}

// Returns per each date in range: { date, count, party_sum }
export async function getCalendarDots(restaurantId: string, from: string, to: string) {
  const rows = await db.query.reservations.findMany({
    where: (r, { and, eq, gte, lte }) => and(
      eq(r.restaurant_id, restaurantId),
      gte(r.date, from),
      lte(r.date, to),
      // exclude cancelled from dot count
    ),
    columns: { date: true, party_size: true, status: true },
  })

  const map: Record<string, { count: number; pax: number }> = {}
  for (const r of rows) {
    if (r.status === 'cancelled') continue
    if (!map[r.date]) map[r.date] = { count: 0, pax: 0 }
    map[r.date].count++
    map[r.date].pax += r.party_size
  }
  return map
}

export async function getAvailableSlotsForDate(date: string): Promise<string[]> {
  const restaurant = await db.query.restaurants.findFirst()
  if (!restaurant) return []

  const closure = await db.query.closures.findFirst({
    where: (c, { and, eq }) => and(eq(c.restaurant_id, restaurant.id), eq(c.date, date)),
  })
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
  if (!data.customer_phone.trim()) fieldErrors.customer_phone = 'El telèfon és obligatori'
  if (!data.date) fieldErrors.date = 'La data és obligatòria'
  if (!data.time) fieldErrors.time = "L'hora és obligatòria"
  if (Object.keys(fieldErrors).length) return { error: 'Comprova els camps obligatoris', fieldErrors }

  const restaurant = await db.query.restaurants.findFirst()
  if (!restaurant) return { error: 'Restaurant no trobat' }

  // Check capacity for warning (non-blocking)
  const occupied = await db.query.reservations.findMany({
    where: (r, { and, eq, inArray }) => and(
      eq(r.restaurant_id, restaurant.id),
      eq(r.date, data.date),
      eq(r.section, data.section),
      inArray(r.status, ['pending', 'arrived']),
    ),
    columns: { party_size: true },
  })
  const occupiedPax = occupied.reduce((s, r) => s + r.party_size, 0)
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

  const id = crypto.randomUUID()
  await db.insert(reservations).values({
    id,
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
  })

  revalidatePath('/avui')
  revalidatePath('/agenda')
  return { id, warning }
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
  if (!data.customer_name.trim() || !data.customer_phone.trim() || !data.date || !data.time) {
    return { error: 'Comprova els camps obligatoris' }
  }

  await db.update(reservations).set({
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
  }).where(eq(reservations.id, id))

  revalidatePath('/avui')
  revalidatePath('/agenda')
  revalidatePath('/reserva/' + id)
  return { ok: true }
}

export async function cancelReservation(id: string): Promise<{ ok: true }> {
  await db.update(reservations)
    .set({ status: 'cancelled', updated_at: new Date().toISOString() })
    .where(eq(reservations.id, id))
  revalidatePath('/avui')
  revalidatePath('/reserva/' + id)
  return { ok: true }
}
