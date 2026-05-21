'use client'

import { useRouter } from 'next/navigation'

const DIES_CA = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg']
const MESOS_CA = [
  'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
  'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre',
]

interface Props {
  // date dots: { '2026-05-14': { count: 3, pax: 12 }, ... }
  dots: Record<string, { count: number; pax: number }>
  selectedDate: string  // ISO yyyy-mm-dd
  // show 2 months starting from this month
  startMonth?: { year: number; month: number }
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function MonthGrid({
  year, month, dots, selectedDate, onSelect,
}: {
  year: number; month: number
  dots: Props['dots']
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const firstDay = new Date(year, month, 1)
  // Monday-first: (getDay() + 6) % 7
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
        {MESOS_CA[month]} {year}
      </p>
      <div className="grid grid-cols-7 mb-1">
        {DIES_CA.map(d => (
          <div key={d} className="text-center text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = isoDate(year, month, day)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const dot = dots[dateStr]
          const isPast = dateStr < todayStr

          return (
            <button
              key={day}
              onClick={() => onSelect(dateStr)}
              className="relative flex flex-col items-center justify-center rounded py-0.5 text-[12px] font-medium transition-colors"
              style={{
                minWidth: 0,
                background: isSelected ? 'var(--primary)' : isToday ? '#EEF2FF' : 'transparent',
                color: isSelected ? '#fff' : isPast ? 'var(--text-muted)' : 'var(--text)',
              }}
            >
              {day}
              {dot && dot.count > 0 && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--primary)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function MiniCalendar({ dots, selectedDate, startMonth }: Props) {
  const router = useRouter()
  const base = startMonth ?? {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  }

  const months = [
    { year: base.year, month: base.month },
    {
      year: base.month === 11 ? base.year + 1 : base.year,
      month: base.month === 11 ? 0 : base.month + 1,
    },
  ]

  function handleSelect(date: string) {
    router.push(`/avui?data=${date}`)
  }

  return (
    <div>
      {months.map(({ year, month }) => (
        <MonthGrid
          key={`${year}-${month}`}
          year={year}
          month={month}
          dots={dots}
          selectedDate={selectedDate}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}
