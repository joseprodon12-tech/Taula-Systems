const DAY_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

export function isDayOpen(
  schedule: Record<string, { lunch?: string; dinner?: string } | null>,
  date: Date
): boolean {
  const dayName = DAY_MAP[date.getDay()]
  return schedule[dayName] !== null && schedule[dayName] !== undefined
}

export function getTimeSlotsForDate(
  schedule: Record<string, { lunch?: string; dinner?: string } | null>,
  date: Date
): string[] {
  const dayName = DAY_MAP[date.getDay()]
  const daySchedule = schedule[dayName]
  if (!daySchedule) return []

  const slots: string[] = []

  if (daySchedule.lunch) {
    slots.push(...generateSlots(daySchedule.lunch))
  }
  if (daySchedule.dinner) {
    slots.push(...generateSlots(daySchedule.dinner))
  }

  return slots
}

function generateSlots(range: string): string[] {
  const [start, end] = range.split('-')
  const slots: string[] = []

  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)

  let currentH = startH
  let currentM = startM

  while (currentH < endH || (currentH === endH && currentM < endM)) {
    slots.push(`${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`)
    currentM += 30
    if (currentM >= 60) {
      currentM -= 60
      currentH += 1
    }
  }

  return slots
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ca-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('ca-ES', {
    day: 'numeric',
    month: 'long',
  })
}

export const DAY_NAMES_CA: Record<string, string> = {
  monday: 'Dilluns',
  tuesday: 'Dimarts',
  wednesday: 'Dimecres',
  thursday: 'Dijous',
  friday: 'Divendres',
  saturday: 'Dissabte',
  sunday: 'Diumenge',
}
