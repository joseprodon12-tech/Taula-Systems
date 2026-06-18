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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
          {dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {activeEmps.length} {activeEmps.length === 1 ? t('equip.gantt.persona') : t('equip.gantt.persones')}
        </span>
        {calendarDots && calendarDots.pax > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🍽 {calendarDots.pax} pax</span>
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
          <div style={{ minWidth: 400, position: 'relative' }}>

            {/* Time axis header */}
            <div style={{ height: HEADER_H, borderBottom: '2px solid var(--border)', position: 'relative' }}>
              {ticks.map((tick, i) => (
                <span key={tick} style={{
                  position: 'absolute',
                  left: `${(tick - axisStart) / totalMinutes * 100}%`,
                  transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                  top: 8, fontSize: 11, color: 'var(--text-muted)', pointerEvents: 'none',
                }}>
                  {fmtHour(tick)}
                </span>
              ))}
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
                      {ticks.map(tick => (
                        <div key={tick} style={{
                          position: 'absolute',
                          left: `${(tick - axisStart) / totalMinutes * 100}%`,
                          top: 0, bottom: 0, width: 1,
                          background: 'var(--border)', opacity: 0.6, pointerEvents: 'none',
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
                        const barLeft = (toMin(shift.start_time) - axisStart) / totalMinutes * 100
                        const barWidth = (normEndMin(shift.start_time, shift.end_time) - toMin(shift.start_time)) / totalMinutes * 100
                        const barBg = shift.published ? emp.color : 'var(--draft-bg)'
                        const barText = shift.published ? 'white' : 'var(--primary-hover)'
                        const barBorder = isOverlapRow
                          ? '2px dashed var(--state-noshow)'
                          : shift.published
                            ? '2px solid transparent'
                            : `2px dashed ${emp.color}`

                        return (
                          <div
                            key={shift.id}
                            data-shiftbar={shift.id}
                            onClick={e => {
                              e.stopPropagation()
                              onOpenEditor?.(emp.id, date, shift)
                            }}
                            title={`${shift.start_time}–${shift.end_time}${shift.notes ? ` · ${shift.notes}` : ''}`}
                            style={{
                              position: 'absolute',
                              left: `${barLeft}%`, width: `${barWidth}%`,
                              top: 10, bottom: 10,
                              background: barBg,
                              borderRadius: 6,
                              border: barBorder,
                              opacity: 1,
                              display: 'flex', alignItems: 'center',
                              padding: '0 6px', overflow: 'hidden',
                              cursor: role === 'owner' ? 'pointer' : 'default',
                              boxSizing: 'border-box',
                              transition: 'background-color 0.3s',
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

            {/* Línia d'hora actual (ambre), relativa a la zona de barres */}
            {nowRatio !== null && (
              <div style={{
                position: 'absolute',
                left: `${nowRatio * 100}%`,
                top: 0, bottom: 0, width: 2,
                background: 'var(--primary)',
                pointerEvents: 'none', zIndex: 5,
              }}>
                <div style={{
                  position: 'absolute', top: 4, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--primary)',
                }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
