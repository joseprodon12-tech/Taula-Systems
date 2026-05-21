import type { WeeklyHours } from '@/db/schema'

function dayHoursFor(weeklyHours: WeeklyHours, date: string) {
  const [y, mo, d] = date.split('-').map(Number)
  const dow = new Date(y, mo - 1, d).getDay()
  const day = weeklyHours[dow.toString()]
  if (!day || day.closed) return null
  return day
}

export function getLunchHours(weeklyHours: WeeklyHours, date: string): [string, string] | null {
  const day = dayHoursFor(weeklyHours, date)
  return day?.lunch ?? null
}

export function getDinnerHours(weeklyHours: WeeklyHours, date: string): [string, string] | null {
  const day = dayHoursFor(weeklyHours, date)
  return day?.dinner ?? null
}

function generateSlots(start: string, end: string): string[] {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  const slots: string[] = []
  for (let m = startMins; m < endMins; m += 15) {
    const h = Math.floor(m / 60).toString().padStart(2, '0')
    const min = (m % 60).toString().padStart(2, '0')
    slots.push(`${h}:${min}`)
  }
  return slots
}

export function getAvailableSlots(weeklyHours: WeeklyHours, date: string): string[] {
  const [y, mo, d] = date.split('-').map(Number)
  const dayOfWeek = new Date(y, mo - 1, d).getDay()
  const dayHours = weeklyHours[dayOfWeek.toString()]
  if (!dayHours || dayHours.closed) return []

  const slots: string[] = []
  if (dayHours.lunch) slots.push(...generateSlots(dayHours.lunch[0], dayHours.lunch[1]))
  if (dayHours.dinner) slots.push(...generateSlots(dayHours.dinner[0], dayHours.dinner[1]))
  return slots
}
