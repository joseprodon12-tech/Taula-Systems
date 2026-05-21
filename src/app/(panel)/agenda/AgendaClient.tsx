'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import type { Reservation } from '@/db/schema'

const STATUS_BADGE: Record<string, string> = {
  pending:   'badge-pending',
  arrived:   'badge-arrived',
  no_show:   'badge-noshow',
  cancelled: 'badge-cancel',
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMondayISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const diff = date.getDay() === 0 ? -6 : 1 - date.getDay()
  date.setDate(date.getDate() + diff)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface Props {
  monday: string
  today: string
  reservationsByDay: Record<string, Reservation[]>
}

export default function AgendaClient({ monday, today, reservationsByDay }: Props) {
  const router = useRouter()
  const { t, locale } = useT()
  const il = locale === 'ca' ? 'ca' : 'es'

  const prevMonday  = addDays(monday, -7)
  const nextMonday  = addDays(monday, 7)
  const todayMonday = getMondayISO(today)

  // Week range label: "19–25 maig 2026" or "28 abr – 4 mai 2026"
  const sunday = addDays(monday, 6)
  const [my, mm, md] = monday.split('-').map(Number)
  const [sy, , sd] = sunday.split('-').map(Number)
  const sundayMonth = Number(sunday.split('-')[1])
  const mondayDate = new Date(my, mm - 1, md)
  const sundayDate = new Date(sy, sundayMonth - 1, sd)
  const monthFmt = new Intl.DateTimeFormat(il, { month: 'long' })
  const rangeLabel = mm === sundayMonth
    ? `${md}–${sd} ${monthFmt.format(mondayDate)} ${my}`
    : `${md} ${monthFmt.format(mondayDate).slice(0, 3)} – ${sd} ${monthFmt.format(sundayDate).slice(0, 3)} ${sy}`

  // Build 7-day list
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(monday, i)
    const [dy, dm, dd] = iso.split('-').map(Number)
    const date = new Date(dy, dm - 1, dd)
    const weekday = new Intl.DateTimeFormat(il, { weekday: 'long' }).format(date)
    const dayLabel = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${dd}`
    const all = reservationsByDay[iso] ?? []
    const rsvs = all.filter(r => r.status !== 'cancelled')
    const pax  = rsvs.reduce((s, r) => s + r.party_size, 0)
    return { iso, dayLabel, rsvs, isPast: iso < today, isToday: iso === today }
  })

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: '0 10px' }}
          onClick={() => router.push(`/agenda?setmana=${prevMonday}`)}
          title={t('agenda.setmanaAnterior')}
        >
          <ChevronLeft size={16} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{rangeLabel}</div>
          {todayMonday !== monday && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 4, fontSize: 12, minHeight: 24, padding: '0 10px' }}
              onClick={() => router.push(`/agenda?setmana=${todayMonday}`)}
            >
              {t('common.avui')}
            </button>
          )}
        </div>

        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: '0 10px' }}
          onClick={() => router.push(`/agenda?setmana=${nextMonday}`)}
          title={t('agenda.setmanaSeguent')}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Days ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {days.map(({ iso, dayLabel, rsvs, isPast, isToday }) => {
          const pax = rsvs.reduce((s, r) => s + r.party_size, 0)
          return (
            <div
              key={iso}
              className="card"
              style={{ padding: 0, opacity: isPast && !isToday ? 0.6 : 1 }}
            >
              {/* Day header row */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: rsvs.length ? '1px solid var(--border)' : undefined,
                }}
                onClick={() => router.push(`/avui?data=${iso}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isToday && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: 'var(--primary)', flexShrink: 0, display: 'inline-block',
                    }} />
                  )}
                  <span style={{
                    fontWeight: 600, fontSize: 15,
                    color: isToday ? 'var(--primary)' : isPast ? 'var(--text-muted)' : 'var(--text)',
                  }}>
                    {dayLabel}
                  </span>
                </div>
                {rsvs.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {rsvs.length} {rsvs.length === 1 ? t('avui.reserva') : t('avui.reserves')}
                    {' · '}{pax} {pax === 1 ? t('avui.persona') : t('avui.persones')}
                  </span>
                )}
              </div>

              {/* Reservation rows */}
              {rsvs.length > 0 ? rsvs.map((r, idx) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', cursor: 'pointer',
                    borderTop: idx > 0 ? '1px solid var(--border)' : undefined,
                  }}
                  onClick={() => router.push(`/reserva/${r.id}`)}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>
                    {r.time}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>
                    ×{r.party_size}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.customer_name}
                  </span>
                  <span className={`badge ${STATUS_BADGE[r.status] ?? 'badge-pending'}`} style={{ flexShrink: 0 }}>
                    {t(`reserva.estats.${r.status}` as Parameters<typeof t>[0])}
                  </span>
                </div>
              )) : (
                <div style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('avui.sense')}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
