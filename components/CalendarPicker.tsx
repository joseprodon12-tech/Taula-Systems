'use client'

import { useState } from 'react'
import { isDayOpen } from '@/lib/schedule'

interface Props {
  schedule: Record<string, { lunch?: string; dinner?: string } | null>
  selectedDate: Date | null
  onSelect: (date: Date) => void
}

const MONTHS_CA = [
  'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
  'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre',
]

const DAYS_CA = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg']

export default function CalendarPicker({ schedule, selectedDate, onSelect }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1)
  // Convert Sunday=0 to Monday=0 for European calendar
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1))
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1))
  }

  const canGoPrev = new Date(year, month, 1) > new Date(today.getFullYear(), today.getMonth(), 1)

  function handleDayClick(day: number) {
    const date = new Date(year, month, day)
    if (date < today) return
    if (!isDayOpen(schedule, date)) return
    onSelect(date)
  }

  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
  }

  return (
    <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="p-1 rounded-lg disabled:opacity-30 hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-semibold text-gray-900 text-sm">
          {MONTHS_CA[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAYS_CA.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 p-2 gap-1">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const date = new Date(year, month, day)
          const isPast = date < today
          const isClosed = !isDayOpen(schedule, date)
          const isSelected = selectedDate && isSameDay(date, selectedDate)
          const isToday = isSameDay(date, today)
          const isDisabled = isPast || isClosed

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              disabled={isDisabled}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected ? 'bg-blue-600 text-white font-bold' : ''}
                ${!isSelected && !isDisabled ? 'hover:bg-blue-50 hover:text-blue-700' : ''}
                ${isToday && !isSelected ? 'border-2 border-blue-300 text-blue-600' : ''}
              `}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
