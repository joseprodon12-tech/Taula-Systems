'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, List, LayoutGrid } from 'lucide-react'
import ReservationCard from '@/components/ReservationCard'
import MiniCalendar from '@/components/MiniCalendar'
import DatePicker from '@/components/DatePicker'
import GanttView from '@/components/GanttView'
import { Toast, useToast } from '@/components/ui/Toast'
import { moveReservation } from '@/app/actions/reservations'
import { getLunchHours, getDinnerHours } from '@/lib/schedule'
import { useT } from '@/context/LocaleContext'
import type { Reservation, Restaurant, Table } from '@/db/schema'

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function offsetDate(iso: string, days: number): string {
  const d = parseDate(iso)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getShift(time: string): 'dinar' | 'sopar' {
  const [h] = time.split(':').map(Number)
  return h < 17 ? 'dinar' : 'sopar'
}

interface Props {
  reserves: Reservation[]
  selectedDate: string
  today: string
  dots: Record<string, { count: number; pax: number }>
  restaurantCapacity: number
  restaurant: Restaurant
  tables: Table[]
}

export default function AvuiClient({ reserves, selectedDate, today, dots, restaurantCapacity, restaurant, tables }: Props) {
  const router = useRouter()
  const { t } = useT()
  const { toast, show, hide } = useToast()

  async function handleReservationMove(id: string, tableId: string, time: string) {
    const result = await moveReservation(id, tableId, time)
    if ('error' in result) show(result.error, 'error')
  }

  function formatDateHeader(iso: string): string {
    const DIES = ['Dg', 'Dll', 'Dm', 'Dc', 'Dj', 'Dv', 'Ds']
    const MESOS = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre']
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const [ty, tm, td] = today.split('-').map(Number)
    const todayDate = new Date(ty, tm - 1, td)
    const diff = Math.round((date.getTime() - todayDate.getTime()) / 86_400_000)
    const label = `${DIES[date.getDay()]} ${d} ${MESOS[m - 1]}`
    if (diff === 0) return `${t('avui.avuiLabel')} — ${label}`
    if (diff === 1) return `${t('avui.dema')} — ${label}`
    if (diff === -1) return `${t('avui.ahir')} — ${label}`
    return label
  }

  const searchParams = useSearchParams()
  const [view, setView] = useState<'list' | 'gantt'>('list')
  const [showCalendar, setShowCalendar] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('taula_view') as 'list' | 'gantt' | null
    if (saved) setView(saved)
  }, [])

  useEffect(() => {
    if (searchParams.get('created') === '1') {
      show('Reserva creada', 'success')
      router.replace(`/avui?data=${selectedDate}`, { scroll: false })
    }
  }, [])

  function handleViewChange(v: 'list' | 'gantt') {
    setView(v)
    localStorage.setItem('taula_view', v)
  }

  function goDay(offset: number) {
    router.push(`/avui?data=${offsetDate(selectedDate, offset)}`)
  }

  // ── KPIs ──
  const active = reserves.filter(r => r.status !== 'cancelled')
  const totalPax = active.reduce((s, r) => s + r.party_size, 0)
  const dinarPax = active.filter(r => getShift(r.time) === 'dinar').reduce((s, r) => s + r.party_size, 0)
  const soparPax = active.filter(r => getShift(r.time) === 'sopar').reduce((s, r) => s + r.party_size, 0)

  // ── Agrupar per franja (vista llista) ──
  const dinar = active.filter(r => getShift(r.time) === 'dinar')
  const sopar = active.filter(r => getShift(r.time) === 'sopar')

  const startMonth = { year: new Date().getFullYear(), month: new Date().getMonth() }

  const lunchHours  = getLunchHours(restaurant.weekly_hours, selectedDate)
  const dinnerHours = getDinnerHours(restaurant.weekly_hours, selectedDate)

  return (
    <div className="flex gap-6">
      {/* ── Contingut principal ── */}
      <div className="flex-1 min-w-0">

        {/* Capçalera */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => goDay(-1)}
                className="p-1.5 rounded-lg hover:bg-white transition-colors"
                style={{ color: 'var(--text-muted)' }}
                title={t('avui.anteriorDia')}
              >
                <ChevronLeft size={22} />
              </button>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {formatDateHeader(selectedDate)}
              </h1>
              <button
                onClick={() => goDay(1)}
                className="p-1.5 rounded-lg hover:bg-white transition-colors"
                style={{ color: 'var(--text-muted)' }}
                title={t('avui.seguent')}
              >
                <ChevronRight size={22} />
              </button>
            </div>

            {/* KPIs */}
            {active.length > 0 ? (
              <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{active.length}</span>
                {' '}{active.length === 1 ? t('avui.reserva') : t('avui.reserves')}
                {' · '}
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{totalPax}</span>
                {' '}{totalPax === 1 ? t('avui.persona') : t('avui.persones')}
                {dinarPax > 0 && <> · <span style={{ color: 'var(--text)' }}>{dinarPax}{t('avui.pDinar')}</span></>}
                {soparPax > 0 && <> · <span style={{ color: 'var(--text)' }}>{soparPax}{t('avui.pSopar')}</span></>}
              </p>
            ) : (
              <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>{t('avui.sense')}</p>
            )}
          </div>

          {/* Controls dreta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Botó calendari — només visible en mòbil */}
            <button
              className="btn btn-ghost btn-sm md:hidden"
              style={{ padding: '6px 8px' }}
              onClick={() => setShowCalendar(true)}
            >
              <CalendarDays size={16} />
            </button>
            {selectedDate !== today && (
              <button className="btn btn-ghost btn-sm" onClick={() => router.push('/avui')}>
                {t('avui.avuiLabel')}
              </button>
            )}
            {/* Toggle vista */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: 8, padding: 2, border: '1px solid var(--border)' }}>
              <button
                className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', borderRadius: 6, gap: 4 }}
                onClick={() => handleViewChange('list')}
              >
                <List size={14} />
                <span className="hidden sm:inline" style={{ fontSize: 11 }}>{t('avui.vistes.llista')}</span>
              </button>
              <button
                className={`btn btn-sm ${view === 'gantt' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', borderRadius: 6, gap: 4 }}
                onClick={() => handleViewChange('gantt')}
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline" style={{ fontSize: 11 }}>{t('avui.vistes.gantt')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Vista ── */}
        {view === 'list' ? (
          active.length === 0 ? (
            <EmptyState onAdd={() => router.push(`/reserva/nova?data=${selectedDate}`)} />
          ) : (
            <div className="space-y-6">
              {dinar.length > 0 && <Section title={t('avui.dinar')} reserves={dinar} />}
              {sopar.length > 0 && <Section title={t('avui.sopar')} reserves={sopar} />}
            </div>
          )
        ) : (
          <GanttView
            tables={tables}
            reservations={active}
            date={selectedDate}
            lunchHours={lunchHours}
            dinnerHours={dinnerHours}
            onSlotClick={(tableId, time) =>
              router.push(`/reserva/nova?data=${selectedDate}&hora=${time}&taula=${encodeURIComponent(tableId)}`)
            }
            onReservationClick={(id) => router.push(`/reserva/${id}`)}
            onReservationMove={handleReservationMove}
            onWarning={(msg) => show(msg, 'error')}
          />
        )}
      </div>

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:block w-52 shrink-0" aria-label="Calendari i estadístiques">
        <div className="card sticky top-0" style={{ maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          {restaurantCapacity > 0 && (
            <div className="mb-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('avui.capacitat')}: <strong style={{ color: 'var(--text)' }}>{restaurantCapacity}p</strong>
              </p>
              {active.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('avui.ocupat')}: <strong style={{ color: 'var(--text)' }}>{totalPax}p</strong>{' '}
                  ({Math.round((totalPax / restaurantCapacity) * 100)}%)
                </p>
              )}
            </div>
          )}
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
            {t('avui.calendari')}
          </p>
          <MiniCalendar dots={dots} selectedDate={selectedDate} startMonth={startMonth} />
        </div>
      </aside>

      {/* ── FAB "Nova reserva" ── */}
      <button
        onClick={() => router.push(`/reserva/nova?data=${selectedDate}`)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 btn btn-primary btn-lg shadow-lg rounded-full"
        style={{ paddingLeft: 20, paddingRight: 24 }}
      >
        <Plus size={20} />
        <span>{t('reserva.nova')}</span>
      </button>

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
              value={selectedDate}
              onChange={(date) => {
                router.push(`/avui?data=${date}`)
                setShowCalendar(false)
              }}
            />
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1E293B' }}>
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
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}>{hour}</p>
            <div className="space-y-2">
              {byHour[hour].map(r => <ReservationCard key={r.id} reservation={r} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useT()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--primary-soft)' }}>
        <CalendarDays size={28} style={{ color: 'var(--primary)' }} />
      </div>
      <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>{t('avui.sense')}</p>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{t('avui.senseSub')}</p>
      <button className="btn btn-primary" onClick={onAdd}>
        <Plus size={16} />
        {t('reserva.nova')}
      </button>
    </div>
  )
}
