'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useT } from '@/context/LocaleContext'

function parseISO(iso: string): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  value: string
  onChange: (date: string) => void
  error?: boolean
  dropUp?: boolean
  style?: React.CSSProperties
}

export default function DatePicker({ value, onChange, error, dropUp, style }: Props) {
  const today = new Date()
  const selected = parseISO(value)
  const { locale, t } = useT()
  const il = locale === 'ca' ? 'ca' : 'es'

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())
  const containerRef = useRef<HTMLDivElement>(null)

  // Compute locale-aware week day headers and month names
  const WEEK_DAYS = useMemo(() => {
    // Jan 5, 2026 is a Monday — generate Mon..Sun labels
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 0, 5 + i)
      const label = new Intl.DateTimeFormat(il, { weekday: 'short' }).format(d)
      return label.replace('.', '').slice(0, 2).toUpperCase()
    })
  }, [il])

  const monthName = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1)
    const name = new Intl.DateTimeFormat(il, { month: 'long' }).format(d)
    return name.charAt(0).toUpperCase() + name.slice(1)
  }, [il, viewYear, viewMonth])

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Build grid: week starts Monday (offset = Mon=0 ... Sun=6)
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function selectDay(day: number) {
    onChange(toISO(new Date(viewYear, viewMonth, day)))
    setOpen(false)
  }

  function isoOfDay(day: number) {
    return toISO(new Date(viewYear, viewMonth, day))
  }

  const displayValue = selected
    ? `${String(selected.getDate()).padStart(2, '0')}/${String(selected.getMonth() + 1).padStart(2, '0')}/${selected.getFullYear()}`
    : ''

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Trigger button styled as input */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          textAlign: 'left', cursor: 'pointer', width: '100%',
          borderColor: error ? 'var(--state-noshow)' : open ? 'var(--primary)' : undefined,
          color: displayValue ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: 14 }}>{displayValue || 'DD/MM/AAAA'}</span>
        <CalendarDays size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>

      {/* Calendar popup */}
      {open && (
        <div style={{
          position: 'absolute', ...(dropUp ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }), left: 0, zIndex: 50,
          background: 'var(--bg)', border: '1.5px solid var(--border)',
          borderRadius: 14, padding: '20px 20px 16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.16)',
          minWidth: 380,
        }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button
              type="button" onClick={prevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex' }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
              {monthName} {viewYear}
            </span>
            <button
              type="button" onClick={nextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {WEEK_DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 4 }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const iso = isoOfDay(day)
              const isSel = value === iso
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(day)}
                  style={{
                    height: 46, borderRadius: 8, fontSize: 15,
                    fontWeight: isToday ? 700 : 400,
                    background: isSel ? 'var(--primary)' : 'transparent',
                    color: isSel ? '#fff' : isToday ? 'var(--primary)' : 'var(--text)',
                    border: isToday && !isSel ? '1.5px solid var(--primary)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => { onChange(toISO(today)); setOpen(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}
            >
              {t('common.avui')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
