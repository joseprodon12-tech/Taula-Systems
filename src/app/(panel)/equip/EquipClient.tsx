'use client'

import { useMemo, useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, AlertTriangle, Plus } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import { addDays, getMondayISO } from '@/lib/dates'
import { weeklyMinutes, validateWeek } from '@/lib/labor'
import type { Employee, Shift, Absence, WeeklyHours } from '@/db/schema'
import {
  createShift, updateShift, deleteShift,
  duplicateWeek, publishWeek,
} from '@/app/actions/equip'
import ShiftEditor, { type ShiftFormData } from './ShiftEditor'
import { Toast, useToast } from '@/components/ui/Toast'

interface Props {
  monday: string
  today: string
  employees: Employee[]
  shiftsByDay: Record<string, Shift[]>
  absences: Absence[]
  calendarDots: Record<string, { count: number; pax: number }>
  weeklyHours: WeeklyHours
  role: 'owner' | 'staff'
}

type EditorState = {
  mode: 'new' | 'edit'
  employeeId: string
  date: string
  shift?: Shift
  fieldErrors?: Record<string, string>
}

const EMP_COL = 148

export default function EquipClient({
  monday, today, employees, shiftsByDay, absences,
  calendarDots, weeklyHours, role,
}: Props) {
  const router = useRouter()
  const { t, locale } = useT()
  const [isPending, startTransition] = useTransition()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [localShifts, setLocalShifts] = useState(shiftsByDay)
  useEffect(() => { setLocalShifts(shiftsByDay) }, [shiftsByDay])
  const [editor, setEditor] = useState<EditorState | null>(null)

  const sunday = addDays(monday, 6)
  const prevMonday = addDays(monday, -7)
  const nextMonday = addDays(monday, 7)
  const todayMonday = getMondayISO(today)

  // Drag state
  const dragRef = useRef<{
    shiftId: string; fromDate: string; fromEmpId: string
    startX: number; startY: number; active: boolean
    snapshot: Record<string, Shift[]>
  } | null>(null)
  const [dragTarget, setDragTarget] = useState<{ date: string; empId: string } | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)

  // Mobile: selected day
  const [mobileDay, setMobileDay] = useState(
    today >= monday && today <= sunday ? today : monday
  )

  // Week range label
  const il = locale === 'ca' ? 'ca' : 'es'
  const rangeLabel = useMemo(() => {
    const [my, mm, md] = monday.split('-').map(Number)
    const [, sm, sd] = sunday.split('-').map(Number)
    const fmt = new Intl.DateTimeFormat(il, { month: 'long' })
    const mDate = new Date(my, mm - 1, md)
    const sDate = new Date(my, sm - 1, sd)
    return mm === sm
      ? `${md}–${sd} ${fmt.format(mDate)} ${my}`
      : `${md} ${fmt.format(mDate).slice(0, 3)} – ${sd} ${fmt.format(sDate).slice(0, 3)} ${my}`
  }, [monday, sunday, il])

  // 7 days
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(monday, i)
      const [dy, dm, dd] = iso.split('-').map(Number)
      const d = new Date(dy, dm - 1, dd)
      const wd = new Intl.DateTimeFormat(il, { weekday: 'short' }).format(d)
      return {
        iso,
        label: `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${dd}`,
        dots: calendarDots[iso],
      }
    }), [monday, calendarDots, il])

  // Groups (sorted role_labels)
  const groups = useMemo(() => {
    const map: Record<string, Employee[]> = {}
    for (const emp of employees) {
      if (!map[emp.role_label]) map[emp.role_label] = []
      map[emp.role_label].push(emp)
    }
    return Object.entries(map)
  }, [employees])

  // Absence map: empId → date → Absence
  const absenceMap = useMemo(() => {
    const m: Record<string, Record<string, Absence>> = {}
    for (const abs of absences) {
      if (!m[abs.employee_id]) m[abs.employee_id] = {}
      let d = abs.date_from
      while (d <= abs.date_to && d <= sunday) {
        m[abs.employee_id][d] = abs
        d = addDays(d, 1)
      }
    }
    return m
  }, [absences, sunday])

  // All shifts flat for validateWeek
  const allShifts = useMemo(() => Object.values(localShifts).flat(), [localShifts])

  // Validate (pure, cheap)
  const warnings = useMemo(() => validateWeek(allShifts, employees), [allShifts, employees])

  // Weekly hours per employee (in hours)
  const empWeeklyH = useMemo(() => {
    const map: Record<string, number> = {}
    for (const emp of employees) {
      const s = allShifts.filter(sh => sh.employee_id === emp.id)
      map[emp.id] = weeklyMinutes(s) / 60
    }
    return map
  }, [employees, allShifts])

  const draftCount = useMemo(() => allShifts.filter(s => !s.published).length, [allShifts])

  const roleLabels = useMemo(() => [...new Set(employees.map(e => e.role_label))], [employees])

  // ── Action helpers ──────────────────────────────────────────────────────────

  function handleOpenEditor(employeeId: string, date: string, shift?: Shift) {
    if (role !== 'owner') return
    setEditor({ mode: shift ? 'edit' : 'new', employeeId, date, shift })
  }

  function handleSaveShift(data: ShiftFormData) {
    if (editor?.mode === 'new') {
      const optimistic: Shift = {
        id: `tmp-${Date.now()}`,
        restaurant_id: '',
        employee_id: data.employee_id,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        zone: data.zone || null,
        notes: data.notes || null,
        published: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const snapshot = localShifts
      setLocalShifts(prev => ({
        ...prev,
        [data.date]: [...(prev[data.date] ?? []), optimistic].sort((a, b) =>
          a.start_time.localeCompare(b.start_time)
        ),
      }))
      setEditor(null)
      startTransition(async () => {
        const res = await createShift({
          employee_id: data.employee_id,
          date: data.date,
          start_time: data.start_time,
          end_time: data.end_time,
          zone: data.zone || undefined,
          notes: data.notes || undefined,
        })
        if ('error' in res) {
          setLocalShifts(snapshot)
          setEditor({ mode: 'new', employeeId: data.employee_id, date: data.date, fieldErrors: (res as { fieldErrors?: Record<string, string> }).fieldErrors })
          showToast(res.error, 'error')
        }
      })
    } else if (editor?.shift) {
      const old = editor.shift
      const updated: Shift = { ...old, ...data, zone: data.zone || null, notes: data.notes || null, updated_at: new Date().toISOString() }
      const snapshot = localShifts
      setLocalShifts(prev => ({
        ...prev,
        [old.date]: (prev[old.date] ?? []).filter(s => s.id !== old.id),
        [data.date]: [...(prev[data.date] ?? []).filter(s => s.id !== old.id), updated]
          .sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }))
      setEditor(null)
      startTransition(async () => {
        const res = await updateShift(old.id, {
          employee_id: data.employee_id,
          date: data.date,
          start_time: data.start_time,
          end_time: data.end_time,
          zone: data.zone || null,
          notes: data.notes || null,
        })
        if ('error' in res) {
          setLocalShifts(snapshot)
          setEditor({ mode: 'edit', employeeId: old.employee_id, date: old.date, shift: old, fieldErrors: (res as { fieldErrors?: Record<string, string> }).fieldErrors })
          showToast(res.error, 'error')
        }
      })
    }
  }

  function handleDeleteShift(shiftId: string, date: string) {
    setEditor(null)
    const snapshot = localShifts
    setLocalShifts(prev => ({
      ...prev,
      [date]: (prev[date] ?? []).filter(s => s.id !== shiftId),
    }))
    startTransition(async () => {
      const res = await deleteShift(shiftId)
      if ('error' in res) {
        setLocalShifts(snapshot)
        showToast(res.error, 'error')
      }
    })
  }

  function handleDuplicate() {
    startTransition(async () => {
      const res = await duplicateWeek(prevMonday, monday)
      if ('error' in res) { showToast(res.error, 'error'); return }
      const { created, skipped } = res as { created: number; skipped: number }
      showToast(`${created} torns duplicats${skipped ? `, ${skipped} omesos` : ''}`, 'success')
      router.refresh()
    })
  }

  function handlePublish() {
    startTransition(async () => {
      const res = await publishWeek(monday)
      if ('error' in res) { showToast(res.error, 'error'); return }
      const { published } = res as { published: number }
      showToast(`${published} ${t('equip.publicats')}`, 'success')
      // Update locally
      setLocalShifts(prev => {
        const next: Record<string, Shift[]> = {}
        for (const [date, shifts] of Object.entries(prev)) {
          next[date] = shifts.map(s => ({ ...s, published: true }))
        }
        return next
      })
    })
  }

  // ── Drag handlers ───────────────────────────────────────────────────────────

  const handleShiftPointerDown = useCallback((
    e: React.PointerEvent, shift: Shift
  ) => {
    if (role !== 'owner') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      shiftId: shift.id, fromDate: shift.date, fromEmpId: shift.employee_id,
      startX: e.clientX, startY: e.clientY, active: false,
      snapshot: localShifts,
    }
  }, [role, localShifts])

  const handleShiftPointerMove = useCallback((e: React.PointerEvent) => {
    const dr = dragRef.current
    if (!dr) return
    const dx = e.clientX - dr.startX
    const dy = e.clientY - dr.startY
    if (!dr.active && Math.sqrt(dx * dx + dy * dy) < 6) return
    dr.active = true

    // Move ghost
    if (ghostRef.current) {
      ghostRef.current.style.display = 'block'
      ghostRef.current.style.left = `${e.clientX + 8}px`
      ghostRef.current.style.top = `${e.clientY - 16}px`
    }

    // Find cell under cursor
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const cell = el?.closest('[data-cell]')
    if (cell) {
      const d = cell.getAttribute('data-date') ?? ''
      const empId = cell.getAttribute('data-empid') ?? ''
      setDragTarget({ date: d, empId })
    } else {
      setDragTarget(null)
    }
  }, [])

  const handleShiftPointerUp = useCallback((e: React.PointerEvent, shift: Shift) => {
    const dr = dragRef.current
    dragRef.current = null
    if (ghostRef.current) ghostRef.current.style.display = 'none'

    if (!dr?.active) {
      // It was a click — open editor
      setDragTarget(null)
      handleOpenEditor(shift.employee_id, shift.date, shift)
      return
    }

    const target = dragTarget
    setDragTarget(null)
    if (!target || (target.date === dr.fromDate && target.empId === dr.fromEmpId)) return

    // Optimistic move
    const moved: Shift = {
      ...shift, date: target.date, employee_id: target.empId,
      updated_at: new Date().toISOString(),
    }
    setLocalShifts(prev => {
      const next = { ...prev }
      next[dr.fromDate] = (next[dr.fromDate] ?? []).filter(s => s.id !== shift.id)
      next[target.date] = [...(next[target.date] ?? []).filter(s => s.id !== shift.id), moved]
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
      return next
    })

    startTransition(async () => {
      const res = await updateShift(shift.id, {
        employee_id: target.empId,
        date: target.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        zone: shift.zone,
        notes: shift.notes,
      })
      if ('error' in res) {
        setLocalShifts(dr.snapshot)
        showToast(res.error, 'error')
      }
    })
  }, [dragTarget, handleOpenEditor, showToast, startTransition])

  // ── Warning helpers ─────────────────────────────────────────────────────────

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

  function hasWarning(empId: string, date?: string): boolean {
    return warnings.some(w => w.employeeId === empId && (!date || w.date === date))
  }

  function isOverlap(empId: string, date: string): boolean {
    return warnings.some(w => w.employeeId === empId && w.date === date && w.key === 'overlap')
  }

  function hasWeeklyWarning(empId: string): boolean {
    return warnings.some(w => w.employeeId === empId && !w.date)
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function ShiftChip({ shift, isDropTarget }: { shift: Shift; isDropTarget?: boolean }) {
    const emp = employees.find(e => e.id === shift.employee_id)
    const overlap = isOverlap(shift.employee_id, shift.date)
    const borderColor = overlap ? 'var(--state-noshow)' : shift.published ? 'transparent' : 'rgba(255,255,255,0.55)'
    const borderStyle = shift.published ? 'solid' : 'dashed'
    const chipOpacity = shift.published ? 1 : 0.82

    return (
      <div
        data-shiftid={shift.id}
        onPointerDown={e => handleShiftPointerDown(e, shift)}
        onPointerMove={handleShiftPointerMove}
        onPointerUp={e => handleShiftPointerUp(e, shift)}
        style={{
          background: emp?.color ?? 'var(--text-muted)',
          color: 'white',
          borderRadius: 6,
          padding: '2px 6px',
          fontSize: 11,
          fontWeight: 600,
          cursor: role === 'owner' ? 'pointer' : 'default',
          border: `2px ${borderStyle} ${borderColor}`,
          opacity: isDropTarget ? 0.5 : chipOpacity,
          userSelect: 'none',
          touchAction: 'none',
          lineHeight: 1.6,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={`${shift.start_time}–${shift.end_time}${shift.zone ? ` · ${shift.zone}` : ''}`}
      >
        {shift.start_time}–{shift.end_time}
      </div>
    )
  }

  function AbsenceChip({ abs }: { abs: Absence }) {
    const typeKey = `equip.absencies.${abs.type}` as Parameters<typeof t>[0]
    return (
      <div style={{
        background: 'var(--border)',
        color: 'var(--text-muted)',
        borderRadius: 6,
        padding: '2px 6px',
        fontSize: 11,
        fontWeight: 500,
        opacity: 0.7,
        whiteSpace: 'nowrap',
      }}>
        {t(typeKey)}
      </div>
    )
  }

  // ── Desktop grid ────────────────────────────────────────────────────────────

  const multiGroup = groups.length > 1

  function DesktopGrid() {
    return (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: EMP_COL + 7 * 100 + 64 }}>
          {/* Day header row */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 2 }}>
            <div style={{ width: EMP_COL, flexShrink: 0, padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }} />
            {days.map(day => (
              <div
                key={day.iso}
                style={{
                  flex: 1, minWidth: 100, padding: '6px 8px',
                  borderLeft: '1px solid var(--border)',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  fontWeight: 600, fontSize: 13,
                  color: day.iso === today ? 'var(--primary)' : 'var(--text)',
                }}>
                  {day.label}
                </div>
                {day.dots && day.dots.pax > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    🍽 {day.dots.pax} pax
                  </div>
                )}
              </div>
            ))}
            <div style={{ width: 64, flexShrink: 0, padding: '8px 4px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>h</div>
          </div>

          {/* Employee rows */}
          {groups.map(([roleLabel, emps]) => (
            <div key={roleLabel}>
              {multiGroup && (
                <div style={{
                  background: 'var(--surface)', padding: '4px 10px',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                  letterSpacing: '0.06em', borderBottom: '1px solid var(--border)',
                  textTransform: 'uppercase',
                }}>
                  {roleLabel}
                </div>
              )}
              {emps.map(emp => {
                const weekH = empWeeklyH[emp.id] ?? 0
                const warnWeek = hasWarning(emp.id)
                return (
                  <div key={emp.id} style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                    {/* Employee name */}
                    <div style={{
                      width: EMP_COL, flexShrink: 0, padding: '8px 10px',
                      display: 'flex', alignItems: 'center', gap: 6,
                      borderRight: '1px solid var(--border)',
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: emp.color, flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {emp.name}
                      </span>
                    </div>

                    {/* Day cells */}
                    {days.map(day => {
                      const dayShifts = (localShifts[day.iso] ?? []).filter(s => s.employee_id === emp.id)
                      const absence = absenceMap[emp.id]?.[day.iso]
                      const isTarget = dragTarget?.date === day.iso && dragTarget?.empId === emp.id
                      const dayWarn = hasWarning(emp.id, day.iso)

                      return (
                        <div
                          key={day.iso}
                          data-cell="1"
                          data-date={day.iso}
                          data-empid={emp.id}
                          onClick={() => !absence && dayShifts.length === 0 && handleOpenEditor(emp.id, day.iso)}
                          style={{
                            flex: 1, minWidth: 100, padding: '6px 4px',
                            borderLeft: '1px solid var(--border)',
                            display: 'flex', flexDirection: 'column', gap: 2,
                            cursor: role === 'owner' && !absence && dayShifts.length === 0 ? 'pointer' : 'default',
                            background: isTarget ? 'var(--primary-soft)' : day.iso === today ? 'rgba(217,119,6,0.03)' : 'transparent',
                            minHeight: 44,
                            position: 'relative',
                          }}
                        >
                          {absence && <AbsenceChip abs={absence} />}
                          {dayShifts.map(s => (
                            <ShiftChip key={s.id} shift={s} isDropTarget={dragRef.current?.shiftId === s.id && dragRef.current?.active} />
                          ))}
                          {dayWarn && !absence && (
                            <span
                              title={warnings.filter(w => w.employeeId === emp.id && w.date === day.iso)
                                .map(w => warningTitle(w.key)).join('\n')}
                              style={{ position: 'absolute', top: 2, right: 2, lineHeight: 1 }}
                            >
                              <AlertTriangle
                                size={10}
                                style={{ color: isOverlap(emp.id, day.iso) ? 'var(--state-noshow)' : 'var(--warning)' }}
                              />
                            </span>
                          )}
                        </div>
                      )
                    })}

                    {/* Weekly total */}
                    <div style={{
                      width: 64, flexShrink: 0, padding: '8px 4px',
                      borderLeft: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600,
                      color: warnWeek ? 'var(--warning)' : 'var(--text-muted)',
                    }}
                      title={warnWeek
                        ? warnings.filter(w => w.employeeId === emp.id)
                          .map(w => warningTitle(w.key)).join('\n')
                        : undefined}
                    >
                      {weekH > 0 ? `${weekH % 1 === 0 ? weekH : weekH.toFixed(1)}h` : '—'}
                      {warnWeek && <AlertTriangle size={10} style={{ color: 'var(--warning)', marginLeft: 2 }} />}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Mobile day view ─────────────────────────────────────────────────────────

  function MobileView() {
    const dayShiftsAll = (localShifts[mobileDay] ?? [])
    const [mdy, mdm, mdd] = mobileDay.split('-').map(Number)
    const fmt = new Intl.DateTimeFormat(il, { weekday: 'long', day: 'numeric', month: 'long' })
    const dayLabel = fmt.format(new Date(mdy, mdm - 1, mdd))

    return (
      <div>
        {/* Day chips selector */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
          {days.map(day => {
            const active = day.iso === mobileDay
            const [, , dd] = day.iso.split('-').map(Number)
            const wd = new Intl.DateTimeFormat(il, { weekday: 'short' }).format(
              new Date(...(day.iso.split('-').map(Number) as [number, number, number]).map((v, i) => i === 1 ? v - 1 : v) as [number, number, number])
            ).slice(0, 2).toUpperCase()
            return (
              <button
                key={day.iso}
                onClick={() => setMobileDay(day.iso)}
                style={{
                  flexShrink: 0, width: 40, height: 48, borderRadius: 10,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, gap: 1, cursor: 'pointer', border: 'none',
                  background: active ? 'var(--primary)' : 'var(--bg)',
                  color: active ? 'white' : day.iso === today ? 'var(--primary)' : 'var(--text-muted)',
                  outline: active ? 'none' : '1px solid var(--border)',
                }}
              >
                <span>{wd}</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{dd}</span>
              </button>
            )
          })}
        </div>

        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>
          {dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}
        </div>

        {/* Employee cards for the day */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 80 }}>
          {employees.map(emp => {
            const shifts = dayShiftsAll.filter(s => s.employee_id === emp.id)
            const absence = absenceMap[emp.id]?.[mobileDay]
            if (!shifts.length && !absence) return null
            return (
              <div key={emp.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: emp.color, flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{emp.name}</div>
                  {absence
                    ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}><AbsenceChip abs={absence} /></div>
                    : shifts.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.start_time}–{s.end_time}</span>
                        {s.zone && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {s.zone}</span>}
                        {!s.published && <span className="badge badge-draft" style={{ fontSize: 10 }}>{t('equip.torn.esborrany')}</span>}
                        {role === 'owner' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ marginLeft: 'auto', minHeight: 24, padding: '0 6px' }}
                            onClick={() => handleOpenEditor(emp.id, mobileDay, s)}
                          >
                            ···
                          </button>
                        )}
                      </div>
                    ))
                  }
                </div>
              </div>
            )
          })}

          {dayShiftsAll.length === 0 && !employees.some(e => absenceMap[e.id]?.[mobileDay]) && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>
              {t('avui.sense')}
            </div>
          )}
        </div>

        {/* FAB */}
        {role === 'owner' && (
          <button
            className="btn btn-primary"
            style={{
              position: 'fixed', bottom: 72, right: 20, borderRadius: '50%',
              width: 52, height: 52, padding: 0, boxShadow: '0 4px 12px rgba(217,119,6,0.4)',
              zIndex: 30,
            }}
            onClick={() => handleOpenEditor(employees[0]?.id ?? '', mobileDay)}
          >
            <Plus size={22} />
          </button>
        )}
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: '0 10px' }}
          onClick={() => router.push(`/equip?setmana=${prevMonday}`)}
          title={t('agenda.setmanaAnterior')}
        >
          <ChevronLeft size={16} />
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{rangeLabel}</span>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: '0 10px' }}
          onClick={() => router.push(`/equip?setmana=${nextMonday}`)}
          title={t('agenda.setmanaSeguent')}
        >
          <ChevronRight size={16} />
        </button>

        {todayMonday !== monday && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.push(`/equip?setmana=${todayMonday}`)}
          >
            {t('common.avui')}
          </button>
        )}

        {role === 'owner' && (
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDuplicate}
              disabled={isPending}
            >
              {t('equip.duplicarSetmana')}
            </button>
            {draftCount > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handlePublish}
                disabled={isPending}
              >
                {t('equip.publicar')} ({draftCount} {t('equip.esborranys')})
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Desktop grid ── */}
      <div className="hidden md:block">
        <DesktopGrid />
      </div>

      {/* ── Mobile view ── */}
      <div className="md:hidden">
        <MobileView />
      </div>

      {/* ── Editor ── */}
      {editor && (
        <ShiftEditor
          mode={editor.mode}
          employeeId={editor.employeeId}
          date={editor.date}
          shift={editor.shift}
          employees={employees}
          roleLabels={roleLabels}
          weeklyHours={weeklyHours}
          fieldErrors={editor.fieldErrors}
          isPending={isPending}
          onSave={handleSaveShift}
          onDelete={editor.shift
            ? () => handleDeleteShift(editor.shift!.id, editor.shift!.date)
            : undefined}
          onClose={() => setEditor(null)}
          isMobile={typeof window !== 'undefined' && window.innerWidth < 768}
        />
      )}

      {/* Drag ghost */}
      <div
        ref={ghostRef}
        style={{
          display: 'none', position: 'fixed', zIndex: 100,
          pointerEvents: 'none',
          background: 'var(--primary)', color: 'white',
          borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
        }}
      >
        ✥
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </>
  )
}
