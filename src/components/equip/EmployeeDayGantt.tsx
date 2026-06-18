'use client'

import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import { toMin } from '@/lib/labor'
import type { Employee, Shift, Absence, ShiftWithEmployee } from '@/db/schema'
import type { LaborWarning } from '@/lib/labor'
import EmpAvatar from '@/components/ui/EmpAvatar'

const LABEL_COL = 36
const HEADER_H = 32
const SEG_GAP_PX = 28   // px between compressed segments
const SEG_GAP_MIN = 90  // gaps > 90 min trigger compression
const PX_M = 56 / 60    // pixels per minute in compressed mode (~56px/h)

function empGanttDimensions(empCount: number): { rowH: number } {
  if (empCount <= 5)  return { rowH: 64 }
  if (empCount <= 10) return { rowH: 52 }
  if (empCount <= 20) return { rowH: 40 }
  return                     { rowH: 32 }
}

type EmpData = Pick<Employee, 'id' | 'name' | 'role_label' | 'color' | 'avatar_url'>

interface Props {
  date: string
  shifts: ShiftWithEmployee[]
  today?: string
  employees?: Employee[]          // for employees with absences but no shifts on this day
  absences?: Absence[]
  warnings?: LaborWarning[]
  calendarDots?: { count: number; pax: number }
  role?: 'owner' | 'staff'
  onOpenEditor?: (employeeId: string, date: string, shift?: Shift) => void
}

function normEndMin(startTime: string, endTime: string): number {
  const s = toMin(startTime), e = toMin(endTime)
  return e > s ? e : e + 1440
}

function fmtHour(m: number): string {
  const h = Math.floor(((m % 1440) + 1440) % 1440 / 60)
  return `${String(h).padStart(2, '0')}:00`
}

export default function EmployeeDayGantt({
  date, shifts, today = '', employees, absences = [], warnings = [],
  calendarDots, role = 'staff', onOpenEditor,
}: Props) {
  const { t, locale } = useT()
  const il = locale === 'ca' ? 'ca' : 'es'
  const empCount = employees?.length ?? new Set(shifts.map(s => s.employee_id)).size
  const { rowH: ROW_H } = empGanttDimensions(empCount)
  const [nowMin, setNowMin] = useState(-1)
  const [compressed, setCompressed] = useState(true)

  useEffect(() => {
    if (date !== today) { setNowMin(-1); return }
    const update = () => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [date, today])

  // Derive unique employees from shifts + absences (with optional employees fallback for absent-only)
  const activeEmps = useMemo<EmpData[]>(() => {
    const map = new Map<string, EmpData>()
    for (const s of shifts) {
      if (!map.has(s.employee.id)) map.set(s.employee.id, s.employee)
    }
    for (const a of absences) {
      if (!map.has(a.employee_id)) {
        const emp = employees?.find(e => e.id === a.employee_id)
        if (emp) map.set(emp.id, emp)
      }
    }
    return [...map.values()]
  }, [shifts, absences, employees])

  const { axisStart, axisEnd, totalMinutes } = useMemo(() => {
    const times: number[] = []
    for (const s of shifts) {
      times.push(toMin(s.start_time))
      times.push(normEndMin(s.start_time, s.end_time))
    }
    if (!times.length) return { axisStart: 9 * 60, axisEnd: 22 * 60, totalMinutes: 13 * 60 }
    const axisStart = Math.floor((Math.min(...times) - 30) / 60) * 60
    const axisEnd = Math.ceil((Math.max(...times) + 30) / 60) * 60
    return { axisStart, axisEnd, totalMinutes: axisEnd - axisStart }
  }, [shifts])

  const ticks = useMemo(() => {
    const arr: number[] = []
    for (let m = axisStart; m <= axisEnd; m += 60) arr.push(m)
    return arr
  }, [axisStart, axisEnd])

  // Compressed segments: merge shift groups with gap > SEG_GAP_MIN
  type Seg = { startMin: number; endMin: number; offsetPx: number; widthPx: number }
  const segs = useMemo<Seg[] | null>(() => {
    if (!compressed || !shifts.length) return null
    const pts = shifts
      .map(s => ({ start: toMin(s.start_time), end: normEndMin(s.start_time, s.end_time) }))
      .sort((a, b) => a.start - b.start)
    const groups: { start: number; end: number }[] = [{ ...pts[0] }]
    for (let i = 1; i < pts.length; i++) {
      const g = groups[groups.length - 1]
      if (pts[i].start - g.end <= SEG_GAP_MIN) { g.end = Math.max(g.end, pts[i].end) }
      else groups.push({ ...pts[i] })
    }
    if (groups.length <= 1) return null
    let offset = 0
    return groups.map(g => {
      const startMin = Math.floor((g.start - 30) / 60) * 60
      const endMin   = Math.ceil((g.end   + 30) / 60) * 60
      const widthPx  = (endMin - startMin) * PX_M
      const seg = { startMin, endMin, offsetPx: offset, widthPx }
      offset += widthPx + SEG_GAP_PX
      return seg
    })
  }, [shifts, compressed])

  const segsTotalW = segs
    ? segs[segs.length - 1].offsetPx + segs[segs.length - 1].widthPx
    : null

  function segX(min: number): number | null {
    if (!segs) return null
    for (const s of segs) {
      if (min >= s.startMin && min <= s.endMin) return s.offsetPx + (min - s.startMin) * PX_M
    }
    return null
  }

  const segsTicks: number[] = segs
    ? segs.flatMap(s => { const a: number[] = []; for (let m = s.startMin; m <= s.endMin; m += 60) a.push(m); return a })
    : []

  const dayLabel = useMemo(() => {
    const [y, mo, d] = date.split('-').map(Number)
    return new Intl.DateTimeFormat(il, { weekday: 'long', day: 'numeric', month: 'long' })
      .format(new Date(y, mo - 1, d))
  }, [date, il])

  const groups = useMemo(() => {
    const map: Record<string, EmpData[]> = {}
    for (const emp of activeEmps) {
      if (!map[emp.role_label]) map[emp.role_label] = []
      map[emp.role_label].push(emp)
    }
    return Object.entries(map)
  }, [activeEmps])

  const multiGroup = groups.length > 1

  const nowRatio = nowMin >= axisStart && nowMin <= axisEnd
    ? (nowMin - axisStart) / totalMinutes
    : null

  function warningTitle(key: string): string {
    const map: Record<string, string> = {
      overlap: t('equip.torn.solapat'),
      rest12h: t('equip.avisos.descans12h'),
      daily9h: t('equip.avisos.jornada9h'),
      weekly40h: t('equip.avisos.setmana40h'),
      contractHours: t('equip.avisos.contracte'),
      threeTrams: t('equip.avisos.tresTrams'),
      noFreeDay: t('equip.avisos.senseDiaLliure'),
    }
    return map[key] ?? key
  }

  if (activeEmps.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 14, marginBottom: 16 }}>{t('equip.gantt.senseTorns')}</div>
        {role === 'owner' && employees && employees.length > 0 && onOpenEditor && (
          <button className="btn btn-primary btn-sm" onClick={() => onOpenEditor(employees[0].id, date)}>
            <Plus size={14} />{t('equip.gantt.afegirTorn')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Day info header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
          {dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {activeEmps.length} {activeEmps.length === 1 ? t('equip.gantt.persona') : t('equip.gantt.persones')}
        </span>
        {calendarDots && calendarDots.pax > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🍽 {calendarDots.pax} pax</span>
        )}
        {/* Toggle gap compression — only show when there's a multi-segment gap */}
        {segs !== null && (
          <button
            onClick={() => setCompressed(false)}
            style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              color: 'var(--text-muted)', background: 'none', border: 'none', padding: '2px 4px',
            }}
            title="Expandir eix de temps complet"
          >
            ⟷ Expandir
          </button>
        )}
        {!compressed && shifts.length > 0 && (
          <button
            onClick={() => setCompressed(true)}
            style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              color: 'var(--primary)', background: 'none', border: 'none', padding: '2px 4px',
            }}
            title="Comprimir gap entre torns"
          >
            ⟵⟶ Comprimir
          </button>
        )}
      </div>

      {/* Grid: columna de noms fixa + zona de barres amb scroll horitzontal */}
      <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>

        {/* Columna esquerra — avatars fixos, sense scroll */}
        <div style={{ width: LABEL_COL, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
          <div style={{ height: HEADER_H, borderBottom: '2px solid var(--border)' }} />
          {groups.map(([roleLabel, emps]) => (
            <div key={roleLabel}>
              {multiGroup && (
                <div style={{
                  background: 'var(--surface)', height: 28, boxSizing: 'border-box',
                  borderBottom: '1px solid var(--border)',
                }} />
              )}
              {emps.map((emp, rowIdx) => (
                <div key={emp.id} style={{
                  height: ROW_H, display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 10px', borderBottom: '1px solid var(--border)',
                  background: rowIdx % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent',
                }}>
                  <EmpAvatar name={emp.name} color={emp.color} avatarUrl={emp.avatar_url} size={22} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Columna dreta — eix de temps + barres, amb scroll horitzontal */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <div style={{ minWidth: segsTotalW ?? 400, width: segs ? (segsTotalW ?? undefined) : undefined, position: 'relative' }}>

            {/* Time axis header */}
            <div style={{ height: HEADER_H, borderBottom: '2px solid var(--border)', position: 'relative' }}>
              {segs ? (
                <>
                  {segsTicks.map((tick, i) => {
                    const x = segX(tick)
                    if (x === null) return null
                    const isFirst = i === 0
                    const isLast = i === segsTicks.length - 1
                    return (
                      <span key={tick} style={{
                        position: 'absolute', left: x,
                        transform: isFirst ? 'none' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                        top: 8, fontSize: 11, color: 'var(--text-muted)', pointerEvents: 'none',
                      }}>
                        {fmtHour(tick)}
                      </span>
                    )
                  })}
                  {/* Gap indicators between segments */}
                  {segs.slice(0, -1).map((s, i) => (
                    <span key={i} style={{
                      position: 'absolute',
                      left: s.offsetPx + s.widthPx + SEG_GAP_PX / 2,
                      transform: 'translateX(-50%)',
                      top: 8, fontSize: 11, color: 'var(--text-muted)', letterSpacing: 2, pointerEvents: 'none',
                    }}>···</span>
                  ))}
                </>
              ) : (
                ticks.map((tick, i) => (
                  <span key={tick} style={{
                    position: 'absolute',
                    left: `${(tick - axisStart) / totalMinutes * 100}%`,
                    transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                    top: 8, fontSize: 11, color: 'var(--text-muted)', pointerEvents: 'none',
                  }}>
                    {fmtHour(tick)}
                  </span>
                ))
              )}
            </div>

            {/* Employee bar rows */}
            {groups.map(([roleLabel, emps]) => (
              <div key={roleLabel}>
                {multiGroup && (
                  <div style={{
                    background: 'var(--surface)',
                    height: 28, borderBottom: '1px solid var(--border)',
                  }} />
                )}
                {emps.map((emp, rowIdx) => {
                  const empShifts = shifts.filter(s => s.employee_id === emp.id)
                  const absence = absences.find(a => a.employee_id === emp.id)
                  const empWarns = warnings.filter(w => w.employeeId === emp.id && w.date === date)
                  const isOverlapRow = empWarns.some(w => w.key === 'overlap')

                  return (
                    <div
                      key={emp.id}
                      style={{
                        height: ROW_H, position: 'relative',
                        borderBottom: '1px solid var(--border)',
                        background: rowIdx % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent',
                        cursor: role === 'owner' && !absence ? 'pointer' : 'default',
                      }}
                      onClick={e => {
                        if (role !== 'owner' || absence || !onOpenEditor) return
                        if ((e.target as HTMLElement).closest('[data-shiftbar]')) return
                        onOpenEditor(emp.id, date)
                      }}
                    >
                      {/* Vertical tick lines */}
                      {(segs ? segsTicks : ticks).map(tick => {
                        const left = segs ? segX(tick) : (tick - axisStart) / totalMinutes * 100
                        if (left === null) return null
                        return (
                          <div key={tick} style={{
                            position: 'absolute',
                            left: segs ? left : `${left}%`,
                            top: 0, bottom: 0, width: 1,
                            background: 'var(--border)', opacity: 0.6, pointerEvents: 'none',
                          }} />
                        )
                      })}

                      {/* Gap hatching between segments */}
                      {segs?.slice(0, -1).map((s, i) => (
                        <div key={i} style={{
                          position: 'absolute', left: s.offsetPx + s.widthPx, width: SEG_GAP_PX,
                          top: 0, bottom: 0, pointerEvents: 'none',
                          background: 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.05) 3px,rgba(0,0,0,0.05) 6px)',
                        }} />
                      ))}

                      {/* Absence full-row bar */}
                      {absence && (
                        <div style={{
                          position: 'absolute', left: '1%', right: '1%', top: 10, bottom: 10,
                          background: 'var(--border)', borderRadius: 6, opacity: 0.6,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, color: 'var(--text-muted)', fontWeight: 500,
                        }}>
                          {t(`equip.absencies.${absence.type}` as Parameters<typeof t>[0])}
                        </div>
                      )}

                      {/* Shift bars */}
                      {!absence && empShifts.map((shift, shiftIdx) => {
                        const startMin = toMin(shift.start_time)
                        const endMin = normEndMin(shift.start_time, shift.end_time)
                        const barBg = shift.published ? emp.color : 'var(--draft-bg)'
                        const barText = shift.published ? 'white' : 'var(--primary-hover)'
                        const barBorder = isOverlapRow
                          ? '2px dashed var(--state-noshow)'
                          : shift.published
                            ? '2px solid transparent'
                            : `2px dashed ${emp.color}`

                        const leftVal  = segs ? segX(startMin)                  : (startMin - axisStart) / totalMinutes * 100
                        const widthVal = segs ? (endMin - startMin) * PX_M      : (endMin - startMin) / totalMinutes * 100
                        if (leftVal === null) return null

                        return (
                          <div
                            key={shift.id}
                            data-shiftbar={shift.id}
                            onClick={e => { e.stopPropagation(); onOpenEditor?.(emp.id, date, shift) }}
                            title={`${shift.start_time}–${shift.end_time}${shift.notes ? ` · ${shift.notes}` : ''}`}
                            style={{
                              position: 'absolute',
                              left: segs ? leftVal : `${leftVal}%`,
                              width: segs ? widthVal : `${widthVal}%`,
                              top: 10, bottom: 10,
                              background: barBg, borderRadius: 6, border: barBorder,
                              display: 'flex', alignItems: 'center',
                              padding: '0 6px', overflow: 'hidden',
                              cursor: role === 'owner' ? 'pointer' : 'default',
                              boxSizing: 'border-box', transition: 'background-color 0.3s',
                            }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 700, color: barText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {shift.start_time}–{shift.end_time}
                            </span>
                            {empWarns.length > 0 && (isOverlapRow || shiftIdx === 0) && (
                              <span title={empWarns.map(w => warningTitle(w.key)).join('\n')} style={{ display: 'flex', flexShrink: 0, marginLeft: 4 }}>
                                <AlertTriangle size={10} style={{ color: isOverlapRow ? 'var(--state-noshow)' : 'var(--warning)' }} />
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Línia d'hora actual */}
            {(() => {
              const nowLeft = segs ? segX(nowMin) : (nowRatio !== null ? nowRatio * 100 : null)
              if (nowLeft === null || nowMin < 0) return null
              return (
                <div style={{
                  position: 'absolute',
                  left: segs ? nowLeft : `${nowLeft}%`,
                  top: 0, bottom: 0, width: 2,
                  background: 'var(--primary)', pointerEvents: 'none', zIndex: 5,
                }}>
                  <div style={{
                    position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                    width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)',
                  }} />
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
