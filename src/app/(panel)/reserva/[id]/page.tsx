import { notFound } from 'next/navigation'
import { getOrCreateRestaurant } from '@/app/actions/config'
import { getReservationById } from '@/app/actions/reservations'
import { getTables } from '@/app/actions/tables'
import ReservaDetallClient from './ReservaDetallClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReservaDetallPage({ params }: Props) {
  const { id } = await params
  const [reservation, restaurant] = await Promise.all([
    getReservationById(id),
    getOrCreateRestaurant(),
  ])
  if (!reservation) notFound()

  const tables = await getTables(restaurant.id)

  return <ReservaDetallClient reservation={reservation} tables={tables} />
}
