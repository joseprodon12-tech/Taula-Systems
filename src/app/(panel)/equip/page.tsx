import { getRestaurant } from '@/app/actions/config'
import { getEmployees, getShiftsForWeek, getAbsencesForRange } from '@/app/actions/equip'
import { getCalendarDots } from '@/app/actions/reservations'
import { todayISO, addDays, getMondayISO } from '@/lib/dates'
import EquipClient from './EquipClient'

interface Props {
  searchParams: Promise<{ setmana?: string }>
}

export default async function EquipPage({ searchParams }: Props) {
  const { setmana } = await searchParams
  const today = todayISO()
  const monday = setmana ?? getMondayISO(today)
  const sunday = addDays(monday, 6)

  const [{ restaurant, role }, employees, shiftsByDay, absences, calendarDots] =
    await Promise.all([
      getRestaurant(),
      getEmployees(),
      getShiftsForWeek(monday, sunday),
      getAbsencesForRange(monday, sunday),
      getCalendarDots(monday, sunday),
    ])

  return (
    <EquipClient
      monday={monday}
      today={today}
      employees={employees}
      shiftsByDay={shiftsByDay}
      absences={absences}
      calendarDots={calendarDots}
      weeklyHours={restaurant.weekly_hours}
      role={role}
    />
  )
}
