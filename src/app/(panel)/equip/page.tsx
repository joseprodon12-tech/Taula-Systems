import { getRestaurant } from '@/app/actions/config'
import { getEmployees, getShiftsForWeek, getAbsencesForRange } from '@/app/actions/equip'
import { getCalendarDots } from '@/app/actions/reservations'
import { todayISO, addDays, getMondayISO } from '@/lib/dates'
import EquipClient from './EquipClient'

interface Props {
  searchParams: Promise<{ setmana?: string; vista?: string; data?: string }>
}

export default async function EquipPage({ searchParams }: Props) {
  const { setmana, vista, data } = await searchParams
  const today = todayISO()
  const diaInicial = data ?? today
  const monday = setmana ?? getMondayISO(diaInicial)
  const sunday = addDays(monday, 6)

  const [{ restaurant, role }, employees, shiftsByDay, absences, calendarDots] =
    await Promise.all([
      getRestaurant(),
      getEmployees(),
      getShiftsForWeek(monday, sunday),
      getAbsencesForRange(monday, sunday),
      getCalendarDots(today, addDays(today, 62)),
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
      vistaInicial={vista === 'dia' ? 'dia' : 'setmana'}
      diaInicial={diaInicial}
    />
  )
}
