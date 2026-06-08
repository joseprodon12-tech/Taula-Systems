import { getRestaurant } from '@/app/actions/config'
import { getReservationsForDay, getCalendarDots } from '@/app/actions/reservations'
import { getTables } from '@/app/actions/tables'
import AvuiClient from './AvuiClient'

interface Props {
  searchParams: Promise<{ data?: string }>
}

export default async function AvuiPage({ searchParams }: Props) {
  const { data: dateParam } = await searchParams

  const today = new Date().toISOString().split('T')[0]
  const selectedDate = dateParam ?? today

  const { restaurant } = await getRestaurant()

  const [reserves, dots, tables] = await Promise.all([
    getReservationsForDay(restaurant.id, selectedDate),
    getCalendarDots(
      restaurant.id,
      new Date().toISOString().split('T')[0],
      (() => { const d = new Date(); d.setMonth(d.getMonth() + 2); return d.toISOString().split('T')[0] })(),
    ),
    getTables(restaurant.id),
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
