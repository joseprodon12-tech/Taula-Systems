'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Users, Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Cell, LabelList, ResponsiveContainer } from 'recharts'
import DatePicker from '@/components/DatePicker'
import EmpAvatar from '@/components/ui/EmpAvatar'
import { Toast, useToast } from '@/components/ui/Toast'
import { useT } from '@/context/LocaleContext'
import { addDays } from '@/lib/dates'
import { rememberReturnView } from '@/lib/tornar'
import type { Reservation, ShiftWithEmployee } from '@/db/schema'

// SVG fill no suporta CSS variables; hex literals del tema terracota
const CHART_CURRENT = '#A3442D'
const CHART_PAST    = '#CDD2CE'
const CHART_FUTURE  = '#D9A490'

export type AvisoData =
  | { key: 'senseHoraris'; nextMonday: string }
  | { key: 'senseTaula'; count: number; firstId: string }
  | { key: 'standby'; count: number; firstName: string; firstId: string }

interface Props {
  reserves: Reservation[]
  shiftsToday: ShiftWithEmployee[]
  hourlyData: { hour: string; pax: number; reservations: number }[]
  avisos: AvisoData[]
  selectedDate: string
  today: string
}

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function normEnd(start: string, end: string): number {
  const s = toMin(start), e = toMin(end)
  return e > s ? e : e + 1440
}

type EmpStatus = 'working' | 'soon' | 'done' | 'future'

function getEmpStatus(shifts: ShiftWithEmployee[], nowMin: number): EmpStatus {
  for (const s of shifts) {
    if (nowMin >= toMin(s.start_time) && nowMin < normEnd(s.start_time, s.end_time)) return 'working'
  }
  for (const s of shifts) {
    const start = toMin(s.start_time)
    if (start > nowMin && start - nowMin < 60) return 'soon'
  }
  if (shifts.every(s => nowMin >= normEnd(s.start_time, s.end_time))) return 'done'
  return 'future'
}

export default function AvuiClient({ reserves, shiftsToday, hourlyData, avisos, selectedDate, today }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale } = useT()
  const { toast, show, hide } = useToast()
  const [showCalendar, setShowCalendar] = useState(false)

  useEffect(() => {
    if (searchParams.get('created') === '1') {
      show('Reserva creada', 'success')
      router.replace(`/avui?data=${selectedDate}`, { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { rememberReturnView() }, [selectedDate])

  function formatDateHeader(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const [ty, tm, td] = today.split('-').map(Number)
    const diff = Math.round((date.getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000)
    const il = locale === 'ca' ? 'ca' : 'es'
    const weekday = new Intl.DateTimeFormat(il, { weekday: 'long' }).format(date)
    const month = new Intl.DateTimeFormat(il, { month: 'long' }).format(date)
    const label = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${d} ${month}`
    if (diff === 0) return `${t('avui.avuiLabel')} — ${label}`
    if (diff === 1) return `${t('avui.dema')} — ${label}`
    if (diff === -1) return `${t('avui.ahir')} — ${label}`
    return label
  }

  function formatNextMonday(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return `${date.getDate()}/${date.getMonth() + 1}`
  }

  const active = reserves.filter(r => r.status !== 'cancelled')
  const totalPax = active.reduce((s, r) => s + r.party_size, 0)
  const dinarPax = active.filter(r => toMin(r.time) < 17 * 60).reduce((s, r) => s + r.party_size, 0)
  const soparPax = active.filter(r => toMin(r.time) >= 17 * 60).reduce((s, r) => s + r.party_size, 0)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nowHour = new Date().getHours()

  const isToday = selectedDate === today

  const upcoming = useMemo(() => {
    const now = new Date().getHours() * 60 + new Date().getMinutes()
    return active
      .filter(r => r.status !== 'arrived')
      .filter(r => toMin(r.time) > now)
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 3)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  // Qui seu ara: la reserva ocupa la taula des de l'hora fins que s'acaba la durada
  const seatedPax = isToday
    ? active
        .filter(r => r.status !== 'no_show')
        .filter(r => { const s = toMin(r.time); return nowMin >= s && nowMin < s + r.duration_minutes })
        .reduce((s, r) => s + r.party_size, 0)
    : 0
  const perVenir = isToday ? active.filter(r => toMin(r.time) > nowMin).length : 0

  const empEntries = useMemo(() => {
    const map = new Map<string, { emp: ShiftWithEmployee['employee']; shifts: ShiftWithEmployee[] }>()
    for (const s of shiftsToday) {
      if (!map.has(s.employee.id)) map.set(s.employee.id, { emp: s.employee, shifts: [] })
      map.get(s.employee.id)!.shifts.push(s)
    }
    return [...map.values()].sort((a, b) => toMin(a.shifts[0].start_time) - toMin(b.shifts[0].start_time))
  }, [shiftsToday])

  const totalEmps = empEntries.length

  return (
    <div className="today-page">
      {/* ── Capçalera ── */}
      <div className="today-header">
        <div className="today-heading">
          <h1>{formatDateHeader(selectedDate).split(' — ')[0]}</h1>
          {formatDateHeader(selectedDate).includes(' — ') && (
            <p className="today-date">{formatDateHeader(selectedDate).split(' — ')[1]}</p>
          )}
        </div>
        <div className="today-controls">
        <button
          onClick={() => router.push(`/avui?data=${addDays(selectedDate, -1)}`)}
          className="today-date-button"
          title={t('avui.anteriorDia')}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={() => router.push(`/avui?data=${addDays(selectedDate, 1)}`)}
          className="today-date-button"
          title={t('avui.seguent')}
        >
          <ChevronRight size={22} />
        </button>
        {selectedDate !== today && (
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/avui')}>
            {t('avui.avuiLabel')}
          </button>
        )}
        <button
          className="today-date-button md:hidden"
          aria-label={t('reserva.camps.data')}
          onClick={() => setShowCalendar(true)}
        >
          <CalendarDays size={16} />
        </button>
        </div>
      </div>

      {/* ── ARA MATEIX: el que passa en aquest moment ── */}
      {isToday && (seatedPax > 0 || upcoming.length > 0) && (
        <div className="card today-now">
          <div className="today-now-head">
            <span>{t('avui.ara.titol')}</span>
            <span>{String(Math.floor(nowMin / 60)).padStart(2, '0')}:{String(nowMin % 60).padStart(2, '0')}</span>
          </div>

          <p className="today-total">
            <strong>{seatedPax}</strong>
            <span>{t('avui.ara.aTaula')} · {perVenir} {perVenir === 1 ? t('avui.reserva') : t('avui.reserves')} {t('avui.ara.perVenir')}</span>
          </p>

          {upcoming.map(r => {
            const minuts = toMin(r.time) - nowMin
            return (
              <div key={r.id} className="today-now-row" onClick={() => router.push(`/reserva/${r.id}`)}>
                <span className="today-now-time">{r.time}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="today-now-name">{r.customer_name}</div>
                  <div className="today-now-sub">
                    {r.party_size} {r.party_size === 1 ? t('avui.ara.persona') : t('avui.ara.persones')}
                    {' · '}
                    {r.table_number ? `${t('avui.ara.taula')} ${r.table_number}` : t('avui.ara.senseTaula')}
                  </div>
                </div>
                {r.allergies.length > 0 && (
                  <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', fontWeight: 700, flexShrink: 0 }}>
                    {t('reserva.camps.alergies')}
                  </span>
                )}
                {minuts <= 15 && (
                  <span className="badge badge-pending" style={{ border: '1px solid var(--border)', flexShrink: 0 }}>
                    {t('avui.ara.enMin').replace('{min}', String(minuts))}
                  </span>
                )}
              </div>
            )
          })}

          <div className="today-now-foot">
            <a href={`/agenda?vista=gantt&data=${selectedDate}`}>{t('avui.ara.veureTotes')}</a>
          </div>
        </div>
      )}

      {/* ── CAL MIRAR: només quan hi ha alguna cosa a fer ── */}
      {avisos.length > 0 && (
        <div className="card today-notifications">
          {avisos.map((aviso, i) => (
            <div key={i} className="today-notification-row">
              {aviso.key === 'senseHoraris' && (
                <>
                  <span>
                    {t('avui.avisos.senseHorarisA')} {formatNextMonday(aviso.nextMonday)} {t('avui.avisos.senseHorarisB')}
                  </span>
                  <a href={`/equip?setmana=${aviso.nextMonday}`}>{t('avui.avisos.anarEquip')}</a>
                </>
              )}
              {aviso.key === 'senseTaula' && (
                <>
                  <span>
                    {aviso.count} {aviso.count === 1 ? t('avui.avisos.senseTaula1') : t('avui.avisos.senseTaula')}
                  </span>
                  <a href={`/reserva/${aviso.firstId}`}>{t('avui.avisos.assignar')}</a>
                </>
              )}
              {aviso.key === 'standby' && (
                <>
                  <span>
                    {aviso.count === 1
                      ? <><strong>{aviso.firstName}</strong> {t('avui.avisos.standbyEspera')}</>
                      : <>{aviso.count} {t('avui.avisos.standbyN')}</>
                    }
                  </span>
                  <a href={`/reserva/${aviso.firstId}`}>{t('avui.avisos.anarReserva')}</a>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ZONA 2: Dues columnes ── */}
      <div className="today-day-label">
        <span>{t('avui.elDia')}</span>
        <div />
      </div>

      <div className="today-grid">

        {/* Columna esquerra: gràfic + properes reserves */}
        <div className="card today-summary">
          <h2 className="today-section-label"><CalendarDays size={18} /><span>{t('avui.reserves')}</span></h2>
          <p className="today-total">
            <strong>{active.length}</strong>
            <span>{active.length === 1 ? t('avui.reserva') : t('avui.reserves')} · {totalPax} {t('avui.persones')}</span>
          </p>
          {active.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              {dinarPax > 0 && <span>{t('avui.dinar')} <strong style={{ color: 'var(--text)' }}>{dinarPax}p</strong></span>}
              {dinarPax > 0 && soparPax > 0 && <span>  ·  </span>}
              {soparPax > 0 && <span>{t('avui.sopar')} <strong style={{ color: 'var(--text)' }}>{soparPax}p</strong></span>}
            </p>
          )}

          {hourlyData.length > 0 ? (
            <div style={{ height: 120, marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 16, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#626969' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Bar dataKey="pax" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="reservations"
                      position="top"
                      formatter={(v) => `${v}${t('avui.resAbrev')}`}
                      style={{ fontSize: 10, fill: '#626969' }}
                    />
                    {hourlyData.map(entry => {
                      const h = parseInt(entry.hour)
                      const color = h === nowHour ? CHART_CURRENT : h < nowHour ? CHART_PAST : CHART_FUTURE
                      return <Cell key={entry.hour} fill={color} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="today-empty">
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Cap reserva per aquest dia.</p>
              <a href={`/reserva/nova?data=${selectedDate}`} className="btn btn-primary"><Plus size={16} />{t('reserva.nova')}</a>
            </div>
          )}

          <div className="today-footer">
            <a href={`/agenda?data=${selectedDate}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
              {t('avui.agendaCompleta')}
            </a>
          </div>
        </div>

        {/* Columna dreta: equip d'avui */}
        <div className="card today-summary">
          <h2 className="today-section-label"><Users size={18} /><span>{t('nav.equip')}</span></h2>
          <p className="today-total">
            <strong>{totalEmps}</strong>
            <span>{totalEmps === 1 ? t('avui.equip.titular1') : t('avui.equip.titular')}</span>
          </p>

          {empEntries.length === 0 ? (
            <div className="today-team-empty">
              <p>
                {t('avui.equip.senseTorns')}
              </p>
              <a href="/equip">
                {t('avui.equip.anarEquip')}
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {empEntries.map(({ emp, shifts }) => {
                const status: EmpStatus = getEmpStatus(shifts, nowMin)
                const dotColor = status === 'working' ? '#16A34A'
                  : status === 'soon' ? '#D97706'
                  : status === 'done' ? '#D1D5DB'
                  : 'transparent'
                const horari = shifts
                  .sort((a, b) => toMin(a.start_time) - toMin(b.start_time))
                  .map(s => `${s.start_time}–${s.end_time}`)
                  .join(' i ')

                return (
                  <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: dotColor === 'transparent' ? 'transparent' : dotColor,
                      border: dotColor === 'transparent' ? '1.5px solid var(--border)' : 'none',
                    }} />
                    <EmpAvatar name={emp.name} color={emp.color} avatarUrl={emp.avatar_url} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{emp.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>{horari}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom sheet calendari (mòbil) ── */}
      {showCalendar && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowCalendar(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-6 pb-8" style={{ background: 'var(--bg)' }}>
            <div className="w-10 h-1 rounded mx-auto mb-4" style={{ background: 'var(--border)' }} />
            <DatePicker inline value={selectedDate} onChange={(date) => { router.push(`/avui?data=${date}`); setShowCalendar(false) }} />
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}
