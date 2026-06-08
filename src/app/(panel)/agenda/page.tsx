import { getRestaurant } from '@/app/actions/config'
import { getReservationsForWeek } from '@/app/actions/reservations'
import AgendaClient from './AgendaClient'

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMondayISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const diff = date.getDay() === 0 ? -6 : 1 - date.getDay()
  date.setDate(date.getDate() + diff)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface Props {
  searchParams: Promise<{ setmana?: string }>
}

export default async function AgendaPage({ searchParams }: Props) {
  const { setmana } = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const monday = setmana ?? getMondayISO(today)
  const sunday = addDays(monday, 6)

  const { restaurant } = await getRestaurant()
  const reservationsByDay = await getReservationsForWeek(restaurant.id, monday, sunday)

  return (
    <AgendaClient
      monday={monday}
      today={today}
      reservationsByDay={reservationsByDay}
    />
  )
}
