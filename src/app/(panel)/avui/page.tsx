import { getReservationsForDay } from '@/app/actions/reservations'
import { getShiftsForDay, getShiftsForWeek } from '@/app/actions/equip'
import { todayISO, addDays, getMondayISO } from '@/lib/dates'

import type { Reservation } from '@/db/schema'
import AvuiClient, { type AvisoData } from './AvuiClient'

interface Props {
  searchParams: Promise<{ data?: string }>
}

function buildHourlyPaxData(reservations: Reservation[]): { hour: string; pax: number; reservations: number }[] {
  const active = reservations.filter(r => r.status !== 'cancelled')
  if (!active.length) return []
  const map: Record<string, { pax: number; reservations: number }> = {}
  for (const r of active) {
    const hour = r.time.slice(0, 2) + ':00'
    if (!map[hour]) map[hour] = { pax: 0, reservations: 0 }
    map[hour].pax += r.party_size
    map[hour].reservations += 1
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, d]) => ({ hour, ...d }))
}

export default async function AvuiPage({ searchParams }: Props) {
  const { data: dateParam } = await searchParams

  const today = todayISO()
  const selectedDate = dateParam ?? today
  const nextMonday = getMondayISO(addDays(today, 7))
  const nextSunday = addDays(nextMonday, 6)

  const [reserves, shiftsToday, nextWeekShiftsByDay] = await Promise.all([
    getReservationsForDay(selectedDate),
    getShiftsForDay(selectedDate),
    getShiftsForWeek(nextMonday, nextSunday),
  ])

  const hourlyData = buildHourlyPaxData(reserves)

  // ── Avisos ──────────────────────────────────────────────────────────────────
  const avisos: AvisoData[] = []

  const hasPublishedNextWeek = Object.values(nextWeekShiftsByDay).flat().some(s => s.published)
  if (!hasPublishedNextWeek) {
    avisos.push({ key: 'senseHoraris', nextMonday })
  }

  const senseTaulaReserves = reserves.filter(r => r.status !== 'cancelled' && !r.table_number)
  if (senseTaulaReserves.length > 0) {
    avisos.push({ key: 'senseTaula', count: senseTaulaReserves.length, firstId: senseTaulaReserves[0].id })
  }

  const standbyReserves = reserves.filter(r => r.status === 'standby')
  if (standbyReserves.length > 0) {
    avisos.push({
      key: 'standby',
      count: standbyReserves.length,
      firstName: standbyReserves[0].customer_name,
      firstId: standbyReserves[0].id,
    })
  }

  return (
    <AvuiClient
      reserves={reserves}
      shiftsToday={shiftsToday}
      hourlyData={hourlyData}
      avisos={avisos}
      selectedDate={selectedDate}
      today={today}
    />
  )
}
