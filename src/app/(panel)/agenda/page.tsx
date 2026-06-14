import { getRestaurant } from '@/app/actions/config'
import { getReservationsForDay, getReservationsForWeek } from '@/app/actions/reservations'
import { getTables } from '@/app/actions/tables'
import { todayISO, addDays, getMondayISO } from '@/lib/dates'
import AgendaClient from './AgendaClient'

interface Props {
  searchParams: Promise<{ vista?: string; data?: string }>
}

export default async function AgendaPage({ searchParams }: Props) {
  const { vista: vistaParam, data: dataParam } = await searchParams
  const today = todayISO()

  const vista = vistaParam === 'llista' ? 'llista' as const
              : vistaParam === 'setmana' ? 'setmana' as const
              : 'gantt' as const

  const selectedDate = dataParam ?? today
  const monday = getMondayISO(selectedDate)
  const { restaurant } = await getRestaurant()

  if (vista === 'setmana') {
    const sunday = addDays(monday, 6)
    const reservationsByDay = await getReservationsForWeek(monday, sunday)
    return (
      <AgendaClient
        vista="setmana"
        today={today}
        selectedDate={monday}
        restaurant={restaurant}
        tables={[]}
        dayReservations={[]}
        reservationsByDay={reservationsByDay}
      />
    )
  }

  const [dayReservations, tables] = await Promise.all([
    getReservationsForDay(selectedDate),
    getTables(),
  ])

  return (
    <AgendaClient
      vista={vista}
      today={today}
      selectedDate={selectedDate}
      restaurant={restaurant}
      tables={tables}
      dayReservations={dayReservations}
      reservationsByDay={{}}
    />
  )
}
