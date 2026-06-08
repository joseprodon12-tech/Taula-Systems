import { notFound } from 'next/navigation'
import { getRestaurant } from '@/app/actions/config'
import { getReservationById, getCustomerHistory } from '@/app/actions/reservations'
import { getTables } from '@/app/actions/tables'
import ReservaDetallClient from './ReservaDetallClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReservaDetallPage({ params }: Props) {
  const { id } = await params
  const [reservation, { restaurant }] = await Promise.all([
    getReservationById(id),
    getRestaurant(),
  ])
  if (!reservation) notFound()

  const [tables, customerHistory] = await Promise.all([
    getTables(restaurant.id),
    getCustomerHistory(reservation.customer_phone),
  ])

  return <ReservaDetallClient reservation={reservation} tables={tables} customerHistory={customerHistory} />
}
