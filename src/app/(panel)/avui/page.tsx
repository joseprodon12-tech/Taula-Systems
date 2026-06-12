import { getRestaurant } from '@/app/actions/config'
import { getReservationsForDay, getCalendarDots } from '@/app/actions/reservations'
import { getTables } from '@/app/actions/tables'
import { todayISO, addDays } from '@/lib/dates'
import AvuiClient from './AvuiClient'

interface Props {
  searchParams: Promise<{ data?: string }>
}

export default async function AvuiPage({ searchParams }: Props) {
  const { data: dateParam } = await searchParams

  const today = todayISO()
  const selectedDate = dateParam ?? today

  const { restaurant } = await getRestaurant()

  const [reserves, dots, tables] = await Promise.all([
    getReservationsForDay(selectedDate),
    getCalendarDots(today, addDays(today, 62)),
    getTables(),
  ])

  return (
    <AvuiClient
      reserves={reserves}
      selectedDate={selectedDate}
      today={today}
      dots={dots}
      restaurantCapacity={restaurant.capacity_indoor + restaurant.capacity_outdoor}
      restaurant={restaurant}
      tables={tables}
    />
  )
}
