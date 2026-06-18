'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import { addDays, getMondayISO } from '@/lib/dates'
import { getLunchHours, getDinnerHours } from '@/lib/schedule'
import { moveReservation } from '@/app/actions/reservations'
import GanttView from '@/components/GanttView'
import MiniCalendar from '@/components/MiniCalendar'
import DatePicker from '@/components/DatePicker'
import ReservationCard from '@/components/ReservationCard'
import { Toast, useToast } from '@/components/ui/Toast'
import type { Restaurant, Table, Reservation } from '@/db/schema'
import type { TKey } from '@/lib/i18n'

type Vista = 'gantt' | 'llista' | 'setmana'

const STATUS_BADGE: Record<string, string> = {
  pending:   'badge-pending',
  arrived:   'badge-arrived',
  no_show:   'badge-noshow',
  cancelled: 'badge-cancel',
  standby:   'badge-standby',
}

const VISTA_KEYS: Record<Vista, TKey> = {
  gantt:   'agenda.vistes.gantt',
  llista:  'agenda.vistes.llista',
  setmana: 'agenda.vistes.setmana',
}

interface Props {
  vista: Vista
  today: string
  selectedDate: string
  restaurant: Restaurant
  tables: Table[]
  dayReservations: Reservation[]
  reservationsByDay: Record<string, Reservation[]>
  dots: Record<string, { count: number; pax: number }>
}

export default function AgendaClient({
  vista, today, selectedDate, restaurant, tables, dayReservations, reservationsByDay, dots,
}: Props) {
  const router = useRouter()
  const { t, locale } = useT()
  const { toast, show, hide } = useToast()
  const il = locale === 'ca' ? 'ca' : 'es'
  const [showCalendar, setShowCalendar] = useState(false)

  function switchVista(v: Vista) {
    const data = v === 'setmana' ? getMondayISO(selectedDate) : selectedDate
    router.push(`/agenda?vista=${v}&data=${data}`)
  }

  async function handleMove(id: string, tableId: string, time: string) {
    const result = await moveReservation(id, tableId, time)
    if ('error' in result) show(result.error, 'error')
  }

  // ── Day header label ───────────────────────────────────────────────────────────
  const [dy, dm, dd] = selectedDate.split('-').map(Number)
  const dayDate = new Date(dy, dm - 1, dd)
  const [ty, tm, td] = today.split('-').map(Number)
  const todayDate = new Date(ty, tm - 1, td)
  const diff = Math.round((dayDate.getTime() - todayDate.getTime()) / 86_400_000)
  const weekdayFmt = new Intl.DateTimeFormat(il, { weekday: 'short' })
  const monthFmt   = new Intl.DateTimeFormat(il, { month: 'long' })
  const dayBaseLabel = `${weekdayFmt.format(dayDate)} ${dd} ${monthFmt.format(dayDate)}`
  const dayLabel = diff === 0 ? `${t('avui.avuiLabel')} — ${dayBaseLabel}`
                 : diff === 1 ? `${t('avui.dema')} — ${dayBaseLabel}`
                 : dayBaseLabel

  // ── Week range label ───────────────────────────────────────────────────────────
  const monday = vista === 'setmana' ? selectedDate : getMondayISO(selectedDate)
  const sunday = addDays(monday, 6)
  const [my, mmo, mdd] = monday.split('-').map(Number)
  const [sy, , sdd] = sunday.split('-').map(Number)
  const sundayMonth = Number(sunday.split('-')[1])
  const mondayDate = new Date(my, mmo - 1, mdd)
  const sundayDateObj = new Date(sy, sundayMonth - 1, sdd)
  const wkMonthFmt = new Intl.DateTimeFormat(il, { month: 'long' })
  const weekRangeLabel = mmo === sundayMonth
    ? `${mdd}–${sdd} ${wkMonthFmt.format(mondayDate)} ${my}`
    : `${mdd} ${wkMonthFmt.format(mondayDate).slice(0, 3)} – ${sdd} ${wkMonthFmt.format(sundayDateObj).slice(0, 3)} ${sy}`

  const todayMonday = getMondayISO(today)
  const lunchHours  = getLunchHours(restaurant.weekly_hours, selectedDate)
  const dinnerHours = getDinnerHours(restaurant.weekly_hours, selectedDate)
  const startMonth  = { year: new Date().getFullYear(), month: new Date().getMonth() }

  function navigateCalendar(date: string) {
    router.push(`/agenda?vista=${vista === 'setmana' ? 'gantt' : vista}&data=${date}`)
  }

  return (
    <div className="flex gap-6">
    <div className="flex-1 min-w-0">
      {/* ── Capçalera ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>

        {/* Commutador 3 modes */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: 8, padding: 2, border: '1px solid var(--border)' }}>
          {(['gantt', 'llista', 'setmana'] as Vista[]).map(v => (
            <button
              key={v}
              className={`btn btn-sm ${vista === v ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 12px', borderRadius: 6, fontSize: 13 }}
              onClick={() => switchVista(v)}
            >
              {t(VISTA_KEYS[v])}
            </button>
          ))}
        </div>

        {/* Navegació diària (Gantt + Llista) */}
        {vista !== 'setmana' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '0 8px' }}
              onClick={() => router.push(`/agenda?vista=${vista}&data=${addDays(selectedDate, -1)}`)}
              title={t('avui.anteriorDia')}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', whiteSpace: 'nowrap', padding: '0 4px' }}>
              {dayLabel}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '0 8px' }}
              onClick={() => router.push(`/agenda?vista=${vista}&data=${addDays(selectedDate, 1)}`)}
              title={t('avui.seguent')}
            >
              <ChevronRight size={16} />
            </button>
            {selectedDate !== today && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => router.push(`/agenda?vista=${vista}&data=${today}`)}
              >
                {t('common.avui')}
              </button>
            )}
          </div>
        )}

        {/* Navegació setmanal */}
        {vista === 'setmana' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '0 8px' }}
              onClick={() => router.push(`/agenda?vista=setmana&data=${addDays(selectedDate, -7)}`)}
              title={t('agenda.setmanaAnterior')}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', whiteSpace: 'nowrap', padding: '0 4px' }}>
              {weekRangeLabel}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '0 8px' }}
              onClick={() => router.push(`/agenda?vista=setmana&data=${addDays(selectedDate, 7)}`)}
              title={t('agenda.setmanaSeguent')}
            >
              <ChevronRight size={16} />
            </button>
            {selectedDate !== todayMonday && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => router.push(`/agenda?vista=setmana&data=${todayMonday}`)}
              >
                {t('common.avui')}
              </button>
            )}
          </div>
        )}

        {/* Botó calendari — només visible en mòbil */}
        <button
          className="btn btn-ghost btn-sm md:hidden"
          style={{ padding: '6px 8px', marginLeft: 'auto' }}
          onClick={() => setShowCalendar(true)}
        >
          <CalendarDays size={16} />
        </button>
      </div>

      {/* ── Contingut ── */}
      {vista === 'gantt' && (
        <GanttView
          tables={tables}
          reservations={dayReservations}
          date={selectedDate}
          lunchHours={lunchHours}
          dinnerHours={dinnerHours}
          onSlotClick={(tableId, time) =>
            router.push(`/reserva/nova?data=${selectedDate}&hora=${time}&taula=${encodeURIComponent(tableId)}`)
          }
          onReservationClick={(id) => router.push(`/reserva/${id}`)}
          onReservationMove={handleMove}
          onWarning={(msg) => show(msg, 'error')}
        />
      )}

      {vista === 'llista' && <ListaView reservations={dayReservations} />}

      {vista === 'setmana' && (
        <SetmanaView
          monday={selectedDate}
          today={today}
          reservationsByDay={reservationsByDay}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>

    {/* ── Sidebar desktop ── */}
    <aside className="hidden xl:block w-52 shrink-0">
      <div className="card sticky top-0" style={{ maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
          {t('avui.calendari')}
        </p>
        <MiniCalendar
          dots={dots}
          selectedDate={vista === 'setmana' ? today : selectedDate}
          startMonth={startMonth}
          navigate={navigateCalendar}
        />
      </div>
    </aside>

    {/* ── Bottom sheet calendari (mòbil) ── */}
    {showCalendar && (
      <>
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowCalendar(false)}
        />
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-6 pb-8" style={{ background: 'var(--bg)' }}>
          <div className="w-10 h-1 rounded mx-auto mb-4" style={{ background: 'var(--border)' }} />
          <DatePicker
            inline
            value={vista === 'setmana' ? today : selectedDate}
            onChange={(date) => {
              navigateCalendar(date)
              setShowCalendar(false)
            }}
          />
        </div>
      </>
    )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ListaView({ reservations }: { reservations: Reservation[] }) {
  const { t } = useT()
  const active = reservations.filter(r => r.status !== 'cancelled')

  if (active.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>Cap reserva aquest dia.</p>
        <a href="/reserva/nova" className="btn btn-primary btn-sm">+ Nova reserva</a>
      </div>
    )
  }

  function getShift(time: string): 'dinar' | 'sopar' {
    const [h] = time.split(':').map(Number)
    return h < 17 ? 'dinar' : 'sopar'
  }

  const dinar = active.filter(r => getShift(r.time) === 'dinar')
  const sopar = active.filter(r => getShift(r.time) === 'sopar')

  return (
    <div className="space-y-6">
      {dinar.length > 0 && <Section title={t('avui.dinar')} reserves={dinar} />}
      {sopar.length > 0 && <Section title={t('avui.sopar')} reserves={sopar} />}
    </div>
  )
}

function Section({ title, reserves }: { title: string; reserves: Reservation[] }) {
  const byHour: Record<string, Reservation[]> = {}
  for (const r of reserves) {
    if (!byHour[r.time]) byHour[r.time] = []
    byHour[r.time].push(r)
  }
  const hours = Object.keys(byHour).sort()

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text)' }}>
          {title}
        </span>
        <div className="flex-1 border-t" style={{ borderColor: 'var(--border)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
          {reserves.reduce((s, r) => s + r.party_size, 0)}p
        </span>
      </div>
      <div className="space-y-4">
        {hours.map(hour => (
          <div key={hour}>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{hour}</p>
            <div className="space-y-2">
              {byHour[hour].map(r => <ReservationCard key={r.id} reservation={r} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SetmanaView({
  monday, today, reservationsByDay,
}: {
  monday: string
  today: string
  reservationsByDay: Record<string, Reservation[]>
}) {
  const router = useRouter()
  const { t, locale } = useT()
  const il = locale === 'ca' ? 'ca' : 'es'

  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(monday, i)
    const [dy, dm, dd] = iso.split('-').map(Number)
    const date = new Date(dy, dm - 1, dd)
    const weekday = new Intl.DateTimeFormat(il, { weekday: 'long' }).format(date)
    const dayLabel = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${dd}`
    const all = reservationsByDay[iso] ?? []
    const rsvs = all.filter(r => r.status !== 'cancelled')
    return { iso, dayLabel, rsvs, isPast: iso < today, isToday: iso === today }
  })

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {days.map(({ iso, dayLabel, rsvs, isPast, isToday }) => {
        const pax = rsvs.reduce((s, r) => s + r.party_size, 0)
        return (
          <div key={iso} className="card" style={{ padding: 0, opacity: isPast && !isToday ? 0.6 : 1 }}>
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
                  {t(`reserva.estats.${r.status}` as TKey)}
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
  )
}
