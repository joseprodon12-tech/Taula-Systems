import { getOrCreateRestaurant } from '@/app/actions/config'
import { getAvailableSlotsForDate } from '@/app/actions/reservations'
import { getTables } from '@/app/actions/tables'
import { db } from '@/db'
import NovaReservaClient from './NovaReservaClient'

interface Props {
  searchParams: Promise<{ data?: string; editar?: string; hora?: string; taula?: string }>
}

export default async function NovaReservaPage({ searchParams }: Props) {
  const { data: dateParam, editar: editarId, hora: horaParam, taula: taulaParam } = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const initialDate = dateParam ?? today

  const restaurant = await getOrCreateRestaurant()
  const [slots, editReservation, tables] = await Promise.all([
    getAvailableSlotsForDate(initialDate),
    editarId
      ? db.query.reservations.findFirst({ where: (r, { eq }) => eq(r.id, editarId) })
      : Promise.resolve(null),
    getTables(restaurant.id),
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
