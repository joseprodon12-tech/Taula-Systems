import { getRestaurant } from '@/app/actions/config'
import { getReservationsForWeek } from '@/app/actions/reservations'
import { todayISO, addDays, getMondayISO } from '@/lib/dates'
import AgendaClient from './AgendaClient'

interface Props {
  searchParams: Promise<{ setmana?: string }>
}

export default async function AgendaPage({ searchParams }: Props) {
  const { setmana } = await searchParams
  const today = todayISO()
  const monday = setmana ?? getMondayISO(today)
  const sunday = addDays(monday, 6)

  const { restaurant } = await getRestaurant()
  const reservationsByDay = await getReservationsForWeek(monday, sunday)

  return (
    <AgendaClient
      monday={monday}
      today={today}
      reservationsByDay={reservationsByDay}
    />
  )
}
