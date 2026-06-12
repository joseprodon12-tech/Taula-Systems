import type { Shift, Employee } from '@/db/schema'

// Detects overlap between two same-day shifts, handling overnight (end < start).
// Normalizes each end time to [start, end+1440] and checks the interval pair
// in both day-offsets so that early-morning/overnight combinations are caught.
export function shiftsOverlap(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number,
): boolean {
  const aNormEnd = aEnd > aStart ? aEnd : aEnd + 1440
  const bNormEnd = bEnd > bStart ? bEnd : bEnd + 1440
  const overlaps = (as: number, ae: number, bs: number, be: number) => as < be && ae > bs
  return (
    overlaps(aStart, aNormEnd, bStart, bNormEnd) ||
    overlaps(aStart, aNormEnd, bStart + 1440, bNormEnd + 1440) ||
    overlaps(aStart + 1440, aNormEnd + 1440, bStart, bNormEnd)
  )
}

export type LaborWarning = {
  key: 'overlap' | 'rest12h' | 'daily9h' | 'weekly40h' | 'contractHours' | 'threeTrams' | 'noFreeDay'
  employeeId: string
  date?: string
  detail: string
  hours?: number
}

type Thresholds = {
  minRestHours?: number
  maxDailyHours?: number
  maxWeeklyHours?: number
}

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function shiftMinutes(s: Shift): number {
  const start = toMin(s.start_time)
  const end = toMin(s.end_time)
  return end > start ? end - start : end + 24 * 60 - start
}

export function dailyMinutes(shifts: Shift[]): number {
  return shifts.reduce((sum, s) => sum + shiftMinutes(s), 0)
}

export function weeklyMinutes(shifts: Shift[]): number {
  return shifts.reduce((sum, s) => sum + shiftMinutes(s), 0)
}

// Minutes between latest end of prevDay and earliest start of nextDay (adjacent calendar days).
// Overnight shifts (end < start) are treated as ending past midnight of prevDay.
export function restBetweenDays(prevShifts: Shift[], nextShifts: Shift[]): number {
  if (!prevShifts.length || !nextShifts.length) return Infinity
  const latestEnd = Math.max(...prevShifts.map(s => {
    const start = toMin(s.start_time)
    const end = toMin(s.end_time)
    return end > start ? end : end + 24 * 60
  }))
  const earliestStart = Math.min(...nextShifts.map(s => toMin(s.start_time) + 24 * 60))
  return earliestStart - latestEnd
}

export function validateWeek(
  shifts: Shift[],
  employees: Employee[],
  thresholds: Thresholds = {},
): LaborWarning[] {
  const minRest = (thresholds.minRestHours ?? 12) * 60
  const maxDaily = (thresholds.maxDailyHours ?? 9) * 60
  const maxWeekly = (thresholds.maxWeeklyHours ?? 40) * 60

  const warnings: LaborWarning[] = []

  for (const emp of employees) {
    const empShifts = shifts.filter(s => s.employee_id === emp.id)
    if (!empShifts.length) continue

    const byDate: Record<string, Shift[]> = {}
    for (const s of empShifts) {
      if (!byDate[s.date]) byDate[s.date] = []
      byDate[s.date].push(s)
    }
    const dates = Object.keys(byDate).sort()

    // overlap: same employee, same day, open-interval formula (rStart < eEnd && rEnd > eStart)
    for (const date of dates) {
      const day = byDate[date]
      for (let i = 0; i < day.length; i++) {
        for (let j = i + 1; j < day.length; j++) {
          const aStart = toMin(day[i].start_time), aEnd = toMin(day[i].end_time)
          const bStart = toMin(day[j].start_time), bEnd = toMin(day[j].end_time)
          if (shiftsOverlap(aStart, aEnd, bStart, bEnd)) {
            warnings.push({ key: 'overlap', employeeId: emp.id, date, detail: date })
          }
        }
      }
    }

    // threeTrams: more than 2 shifts same day
    for (const date of dates) {
      const count = byDate[date].length
      if (count > 2) {
        warnings.push({ key: 'threeTrams', employeeId: emp.id, date, detail: String(count), hours: count })
      }
    }

    // daily9h
    for (const date of dates) {
      const mins = dailyMinutes(byDate[date])
      if (mins > maxDaily) {
        const h = mins / 60
        warnings.push({ key: 'daily9h', employeeId: emp.id, date, detail: String(h), hours: h })
      }
    }

    // rest12h: only between truly adjacent calendar days
    for (let i = 0; i < dates.length - 1; i++) {
      const [ay, am, ad] = dates[i].split('-').map(Number)
      const [by, bm, bd] = dates[i + 1].split('-').map(Number)
      const diffDays = Math.round(
        (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000
      )
      if (diffDays > 1) continue
      const rest = restBetweenDays(byDate[dates[i]], byDate[dates[i + 1]])
      if (rest < minRest) {
        const h = rest / 60
        warnings.push({ key: 'rest12h', employeeId: emp.id, date: dates[i + 1], detail: String(h), hours: h })
      }
    }

    // weekly40h and contractHours
    const totalMins = weeklyMinutes(empShifts)
    if (totalMins > maxWeekly) {
      const h = totalMins / 60
      warnings.push({ key: 'weekly40h', employeeId: emp.id, detail: String(h), hours: h })
    }
    if (emp.contract_hours_week !== null) {
      const contractMins = emp.contract_hours_week * 60
      if (totalMins > contractMins) {
        const h = totalMins / 60
        warnings.push({ key: 'contractHours', employeeId: emp.id, detail: String(h), hours: h })
      }
    }

    // noFreeDay: shifts on all 7 days of the week
    if (dates.length >= 7) {
      warnings.push({ key: 'noFreeDay', employeeId: emp.id, detail: '' })
    }
  }

  return warnings
}
