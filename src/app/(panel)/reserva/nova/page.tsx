import { getRestaurant } from '@/app/actions/config'
import { getAvailableSlotsForDate, getReservationById } from '@/app/actions/reservations'
import { getTables } from '@/app/actions/tables'
import { todayISO } from '@/lib/dates'
import NovaReservaClient from './NovaReservaClient'

interface Props {
  searchParams: Promise<{ data?: string; editar?: string; hora?: string; taula?: string }>
}

export default async function NovaReservaPage({ searchParams }: Props) {
  const { data: dateParam, editar: editarId, hora: horaParam, taula: taulaParam } = await searchParams
  const today = todayISO()
  const initialDate = dateParam ?? today

  const { restaurant } = await getRestaurant()
  const [slots, editReservation, tables] = await Promise.all([
    getAvailableSlotsForDate(initialDate),
    editarId ? getReservationById(editarId) : Promise.resolve(null),
    getTables(),
  ])

  return (
    <NovaReservaClient
      initialDate={initialDate}
      initialSlots={slots}
      initialTime={horaParam ?? ''}
      initialTableId={taulaParam ?? ''}
      restaurant={restaurant}
      editReservation={editReservation ?? null}
      tables={tables}
    />
  )
}
