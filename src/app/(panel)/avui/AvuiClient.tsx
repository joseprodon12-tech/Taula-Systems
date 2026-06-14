'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Cell, LabelList, ResponsiveContainer } from 'recharts'
import MiniCalendar from '@/components/MiniCalendar'
import DatePicker from '@/components/DatePicker'
import EmpAvatar from '@/components/ui/EmpAvatar'
import { Toast, useToast } from '@/components/ui/Toast'
import { useT } from '@/context/LocaleContext'
import { addDays } from '@/lib/dates'
import type { Reservation, ShiftWithEmployee } from '@/db/schema'

// SVG fill no suporta CSS variables; hex literals del tema amber
const CHART_CURRENT = '#D97706'
const CHART_PAST    = '#D1D5DB'
const CHART_FUTURE  = '#FCD34D'

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
  dots: Record<string, { count: number; pax: number }>
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

const DIES  = ['Dg', 'Dll', 'Dm', 'Dc', 'Dj', 'Dv', 'Ds']
const MESOS = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre']

export default function AvuiClient({ reserves, shiftsToday, hourlyData, avisos, selectedDate, today, dots }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useT()
  const { toast, show, hide } = useToast()
  const [showCalendar, setShowCalendar] = useState(false)
  const [showNotif, setShowNotif] = useState(true)

  useEffect(() => {
    if (searchParams.get('created') === '1') {
      show('Reserva creada', 'success')
      router.replace(`/avui?data=${selectedDate}`, { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function formatDateHeader(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const [ty, tm, td] = today.split('-').map(Number)
    const diff = Math.round((date.getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000)
    const label = `${DIES[date.getDay()]} ${d} ${MESOS[m - 1]}`
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

  const startMonth = { year: new Date().getFullYear(), month: new Date().getMonth() }
  const active = reserves.filter(r => r.status !== 'cancelled')
  const totalPax = active.reduce((s, r) => s + r.party_size, 0)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nowHour = new Date().getHours()

  const upcoming = useMemo(() => {
    const now = new Date().getHours() * 60 + new Date().getMinutes()
    return active
      .filter(r => r.status !== 'arrived')
      .filter(r => { const m = toMin(r.time); return m > now && m - now <= 120 })
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 3)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div>
      {/* ── Capçalera ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => router.push(`/avui?data=${addDays(selectedDate, -1)}`)}
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
          onClick={() => router.push(`/avui?data=${addDays(selectedDate, 1)}`)}
          className="p-1.5 rounded-lg hover:bg-white transition-colors"
          style={{ color: 'var(--text-muted)' }}
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
          className="btn btn-ghost btn-sm md:hidden"
          style={{ padding: '6px 8px', marginLeft: 'auto' }}
          onClick={() => setShowCalendar(true)}
        >
          <CalendarDays size={16} />
        </button>
      </div>

      {/* ── ZONA 2: Dues columnes ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>

        {/* Columna esquerra: gràfic + properes reserves */}
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}>{active.length}</span>
            {' '}{active.length === 1 ? t('avui.reserva') : t('avui.reserves')}
            {' · '}
            <span style={{ color: 'var(--primary)' }}>{totalPax}</span>
            {' '}{t('avui.persones')}
          </p>

          {hourlyData.length > 0 ? (
            <div style={{ height: 120, marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 16, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Bar dataKey="pax" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="reservations"
                      position="top"
                      formatter={(v) => `${v}${t('avui.resAbrev')}`}
                      style={{ fontSize: 10, fill: '#9CA3AF' }}
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
            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('avui.sense')}</p>
            </div>
          )}

          {upcoming.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                {t('avui.properes')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {upcoming.map(r => (
                  <div
                    key={r.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                    onClick={() => router.push(`/reserva/${r.id}`)}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', width: 40, flexShrink: 0 }}>{r.time}</span>
                    <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customer_name}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>×{r.party_size}</span>
                    {r.table_number && <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{r.table_number}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <a href={`/agenda?data=${selectedDate}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
              {t('avui.agendaCompleta')}
            </a>
          </div>
        </div>

        {/* Columna dreta: equip d'avui */}
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            <span style={{ color: 'var(--primary)' }}>{totalEmps}</span>
            {' '}{totalEmps === 1 ? t('avui.equip.titular1') : t('avui.equip.titular')}
          </p>

          {empEntries.length === 0 ? (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {t('avui.equip.senseTorns')}
              </p>
              <a href="/equip" style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
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

      {/* ── ZONA 3: Notificacions (toggle) ── */}
      <div className="card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'space-between', padding: '10px 16px', borderRadius: 0, fontSize: 13, color: 'var(--text-muted)' }}
          onClick={() => setShowNotif(v => !v)}
        >
          <span style={{ fontWeight: 600 }}>
            {t('avui.notificacions.titol')}
            {avisos.length > 0 && (
              <span style={{ marginLeft: 6, background: '#F59E0B', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                {avisos.length}
              </span>
            )}
          </span>
          <span>{showNotif ? '▲' : '▼'}</span>
        </button>
        {showNotif && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {avisos.length === 0 ? (
              <p style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                {t('avui.notificacions.cap')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {avisos.map((aviso, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      flexWrap: 'wrap', gap: 8, padding: '10px 16px',
                      borderBottom: i < avisos.length - 1 ? '1px solid var(--border)' : undefined,
                      borderLeft: '3px solid #F59E0B',
                      background: '#FFFBEB',
                    }}
                  >
                    {aviso.key === 'senseHoraris' && (
                      <>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>
                          {t('avui.avisos.senseHorarisA')} {formatNextMonday(aviso.nextMonday)} {t('avui.avisos.senseHorarisB')}
                        </span>
                        <a href={`/equip?setmana=${aviso.nextMonday}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          {t('avui.avisos.anarEquip')}
                        </a>
                      </>
                    )}
                    {aviso.key === 'senseTaula' && (
                      <>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>
                          {aviso.count} {aviso.count === 1 ? t('avui.avisos.senseTaula1') : t('avui.avisos.senseTaula')}
                        </span>
                        <a href={`/reserva/${aviso.firstId}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          {t('avui.avisos.anarReserva')}
                        </a>
                      </>
                    )}
                    {aviso.key === 'standby' && (
                      <>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>
                          {aviso.count === 1
                            ? <><strong>{aviso.firstName}</strong> {t('avui.avisos.standbyEspera')}</>
                            : <>{aviso.count} {t('avui.avisos.standbyN')}</>
                          }
                        </span>
                        <a href={`/reserva/${aviso.firstId}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          {t('avui.avisos.anarReserva')}
                        </a>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Minicalendari (compacte, al peu) ── */}
      <div className="card" style={{ maxWidth: 240 }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
          {t('avui.calendari')}
        </p>
        <MiniCalendar dots={dots} selectedDate={selectedDate} startMonth={startMonth} />
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
