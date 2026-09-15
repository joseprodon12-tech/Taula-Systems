import { getRestaurant } from '@/app/actions/config'
import { getAvailableSlotsForDate, getReservationById, getReservationsForDay } from '@/app/actions/reservations'
import { getTables } from '@/app/actions/tables'
import { todayISO } from '@/lib/dates'
import NovaReservaClient from './NovaReservaClient'

interface Props {
  searchParams: Promise<{ data?: string; editar?: string; hora?: string; taula?: string }>
}

export default async function NovaReservaPage({ searchParams }: Props) {
  const { data: dateParam, editar: editarId, hora: horaParam, taula: taulaParam } = await searchParams

  const [{ restaurant }, editReservation] = await Promise.all([
    getRestaurant(),
    editarId ? getReservationById(editarId) : Promise.resolve(null),
  ])
  // En editar, la disponibilitat és la del dia de la reserva, no la d'avui
  const date = editReservation?.date ?? dateParam ?? todayISO()

  const [slots, dayReservations, tables] = await Promise.all([
    getAvailableSlotsForDate(date),
    getReservationsForDay(date),
    getTables(),
  ])

  return (
    <NovaReservaClient
      initialDate={date}
      initialSlots={slots}
      initialDayReservations={dayReservations}
      initialTime={horaParam ?? ''}
      initialTableId={taulaParam ?? ''}
      restaurant={restaurant}
      editReservation={editReservation}
      tables={tables}
    />
  )
}
