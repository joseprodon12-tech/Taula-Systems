'use client'

import { useMemo, useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, AlertTriangle, Plus, Users, CalendarDays } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import { addDays, getMondayISO } from '@/lib/dates'
import { weeklyMinutes, validateWeek } from '@/lib/labor'
import type { Employee, Shift, ShiftWithEmployee, Absence, WeeklyHours } from '@/db/schema'
import {
  createShift, updateShift, deleteShift,
  duplicateWeek, publishWeek,
} from '@/app/actions/equip'
import ShiftEditor, { type ShiftFormData } from './ShiftEditor'
import EmployeeDayGantt from '@/components/equip/EmployeeDayGantt'
import MiniCalendar from '@/components/MiniCalendar'
import DatePicker from '@/components/DatePicker'
import EmpAvatar from '@/components/ui/EmpAvatar'
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
  vistaInicial: 'setmana' | 'dia'
  diaInicial: string
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
  calendarDots, weeklyHours, role, vistaInicial, diaInicial,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale } = useT()
  const [isPending, startTransition] = useTransition()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [localShifts, setLocalShifts] = useState(shiftsByDay)
  useEffect(() => { setLocalShifts(shiftsByDay) }, [shiftsByDay])
  const [editor, setEditor] = useState<EditorState | null>(null)

  // Obert des d'una altra pàgina via ?nou-torn=1
  useEffect(() => {
    if (searchParams.get('nou-torn') !== '1') return
    if (role !== 'owner' || employees.length === 0) return
    const dataParam = searchParams.get('data')
    const date = dataParam ?? (today >= monday && today <= sunday ? today : monday)
    setEditor({ mode: 'new', employeeId: employees[0].id, date })
    router.replace('/equip', { scroll: false })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const [showCalendar, setShowCalendar] = useState(false)

  // Mobile: selected day ('tot' = weekly overview, ISO date = day Gantt)
  const [mobileDay, setMobileDay] = useState<string>('tot')

  // View toggle state
  const [vista, setVista] = useState<'setmana' | 'dia'>(vistaInicial)
  const [diaGantt, setDiaGantt] = useState(diaInicial)

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

  const diaGanttLabel = useMemo(() => {
    const [y, m, d] = diaGantt.split('-').map(Number)
    return new Intl.DateTimeFormat(il, { weekday: 'short', day: 'numeric', month: 'long' })
      .format(new Date(y, m - 1, d))
  }, [diaGantt, il])

  const dayAbsences = useMemo(() =>
    absences.filter(a => a.date_from <= diaGantt && a.date_to >= diaGantt),
    [absences, diaGantt]
  )

  // Punt 4: escolta l'event 'equip:nou-torn' enviat per PanelUI quan l'usuari toca "+ Nou torn" al FAB global
  useEffect(() => {
    if (role !== 'owner') return
    function handleNouTorn() {
      let date = today >= monday && today <= sunday ? today : monday
      if (mobileDay !== 'tot') date = mobileDay
      else if (vista === 'dia') date = diaGantt
      if (employees.length === 0) return
      setEditor({ mode: 'new', employeeId: employees[0].id, date })
    }
    document.addEventListener('equip:nou-torn', handleNouTorn)
    return () => document.removeEventListener('equip:nou-torn', handleNouTorn)
  }, [role, employees, monday, sunday, today, mobileDay, vista, diaGantt])

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

  function handleAddTram() {
    if (!editor) return
    setEditor({ mode: 'new', employeeId: editor.employeeId, date: editor.date })
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

  function goToDay(day: string) {
    setDiaGantt(day)
    setVista('dia')
    router.push(`/equip?setmana=${getMondayISO(day)}&vista=dia&data=${day}`)
  }

  function switchVista(v: 'setmana' | 'dia') {
    setVista(v)
    if (v === 'dia') router.push(`/equip?setmana=${monday}&vista=dia&data=${diaGantt}`)
    else router.push(`/equip?setmana=${getMondayISO(diaGantt)}`)
  }

  function navDay(delta: number) {
    goToDay(addDays(diaGantt, delta))
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

  function ShiftChip({ shift, isDropTarget, warn, overlap, warnTitle }: {
    shift: Shift; isDropTarget?: boolean; warn?: boolean; overlap?: boolean; warnTitle?: string
  }) {
    const emp = employees.find(e => e.id === shift.employee_id)
    const isOvlp = overlap ?? isOverlap(shift.employee_id, shift.date)
    const shiftTitle = `${shift.start_time}–${shift.end_time}${shift.zone ? ` · ${shift.zone}` : ''}${warnTitle ? `\n${warnTitle}` : ''}`

    // Punt 4: esborranys = fons ambre translúcid + border puntejat color empleat; publicats = sòlid
    const chipBg = shift.published ? (emp?.color ?? 'var(--text-muted)') : 'var(--draft-bg)'
    const chipColor = shift.published ? 'white' : 'var(--primary-hover)'
    const chipBorder = isOvlp
      ? '2px dashed var(--state-noshow)'
      : shift.published
        ? '2px solid transparent'
        : `2px dashed ${emp?.color ?? 'var(--primary)'}`

    return (
      <div
        data-shiftid={shift.id}
        onPointerDown={e => handleShiftPointerDown(e, shift)}
        onPointerMove={handleShiftPointerMove}
        onPointerUp={e => handleShiftPointerUp(e, shift)}
        title={shiftTitle}
        style={{
          background: chipBg,
          color: chipColor,
          borderRadius: 6,
          padding: '2px 6px',
          fontSize: 11,
          fontWeight: 600,
          cursor: role === 'owner' ? 'pointer' : 'default',
          border: chipBorder,
          opacity: isDropTarget ? 0.5 : 1,
          userSelect: 'none',
          touchAction: 'none',
          lineHeight: 1.6,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          transition: 'background-color 0.3s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {shift.start_time}–{shift.end_time}
        </span>
        {warn && (
          <AlertTriangle size={9} style={{ color: isOvlp ? 'var(--state-noshow)' : 'var(--warning)', flexShrink: 0 }} />
        )}
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
    // Punt 7: cap empleat → fila fantasma clicable en lloc de la graella buida
    if (employees.length === 0) {
      return (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: EMP_COL + 7 * 100 + 64, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {/* Capçalera de dies */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ width: EMP_COL, flexShrink: 0, padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }} />
              {days.map(day => (
                <div key={day.iso} style={{ flex: 1, minWidth: 100, padding: '6px 8px', borderLeft: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: day.iso === today ? 'var(--primary)' : 'var(--text)' }}>{day.label}</div>
                </div>
              ))}
              <div style={{ width: 64, flexShrink: 0 }} />
            </div>
            {/* Fila fantasma */}
            <div
              style={{ display: 'flex', cursor: 'pointer', opacity: 0.6 }}
              onClick={() => router.push('/equip/empleats')}
            >
              <div style={{ width: EMP_COL, flexShrink: 0, padding: '10px', display: 'flex', alignItems: 'center', gap: 8, borderRight: '1px solid var(--border)', minHeight: 48 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px dashed var(--border)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nom</span>
              </div>
              {days.map(day => (
                <div key={day.iso} style={{ flex: 1, minWidth: 100, minHeight: 48, borderLeft: '1px solid var(--border)', borderTop: 'none' }} />
              ))}
              <div style={{ width: 64, flexShrink: 0, borderLeft: '1px solid var(--border)' }} />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: EMP_COL + 7 * 100 + 64 }}>
          {/* Day header row */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 2 }}>
            <div style={{ width: EMP_COL, flexShrink: 0, padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }} />
            {days.map(day => (
              <div
                key={day.iso}
                onClick={() => goToDay(day.iso)}
                style={{
                  flex: 1, minWidth: 100, padding: '6px 8px',
                  borderLeft: '1px solid var(--border)',
                  textAlign: 'center', cursor: 'pointer',
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
                      <EmpAvatar name={emp.name} color={emp.color} avatarUrl={emp.avatar_url} size={22} />
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
                          className="equip-cell"
                          onClick={e => {
                            if (absence || role !== 'owner') return
                            if (!(e.target as HTMLElement).closest('[data-shiftid]')) handleOpenEditor(emp.id, day.iso)
                          }}
                          style={{
                            flex: 1, minWidth: 100, padding: '6px 4px',
                            borderLeft: '1px solid var(--border)',
                            display: 'flex', flexDirection: 'column', gap: 2,
                            cursor: role === 'owner' && !absence ? 'pointer' : 'default',
                            background: isTarget ? 'var(--primary-soft)' : day.iso === today ? 'rgba(217,119,6,0.03)' : 'transparent',
                            minHeight: 44,
                            position: 'relative',
                          }}
                        >
                          {absence && <AbsenceChip abs={absence} />}
                          {dayShifts.map(s => (
                            <ShiftChip
                              key={s.id}
                              shift={s}
                              isDropTarget={dragRef.current?.shiftId === s.id && dragRef.current?.active}
                              warn={dayWarn}
                              overlap={isOverlap(emp.id, day.iso)}
                              warnTitle={warnings.filter(w => w.employeeId === emp.id && w.date === day.iso).map(w => warningTitle(w.key)).join('\n')}
                            />
                          ))}
                          {/* Punt 1: indicador + visible en hover quan la cel·la és buida */}
                          {!absence && role === 'owner' && (
                            <span className="equip-cell-hint">+</span>
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
    const chipRow = (
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
        {/* Tot button */}
        <button
          onClick={() => setMobileDay('tot')}
          style={{
            flexShrink: 0, width: 44, height: 48, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: mobileDay === 'tot' ? 'var(--primary)' : 'var(--bg)',
            color: mobileDay === 'tot' ? 'white' : 'var(--text-muted)',
            outline: mobileDay === 'tot' ? 'none' : '1px solid var(--border)',
          }}
        >
          {t('equip.gantt.tot')}
        </button>
        {days.map(day => {
          const active = day.iso === mobileDay
          const [, , dd] = day.iso.split('-').map(Number)
          const parts = day.label.split(' ')
          const wd = parts[0].slice(0, 2).toUpperCase()
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
    )

    // Day Gantt mode
    if (mobileDay !== 'tot') {
      const dayAbs = absences.filter(a => a.date_from <= mobileDay && a.date_to >= mobileDay)
      return (
        <div>
          {chipRow}
          <EmployeeDayGantt
            date={mobileDay}
            today={today}
            employees={employees}
            shifts={(localShifts[mobileDay] ?? []).flatMap(s => { const emp = employees.find(e => e.id === s.employee_id); return emp ? [{ ...s, employee: emp }] : [] }) as ShiftWithEmployee[]}
            absences={dayAbs}
            warnings={warnings}
            calendarDots={calendarDots[mobileDay]}
            role={role}
            onOpenEditor={handleOpenEditor}
          />
        </div>
      )
    }

    // Punt 8: tots els empleats sempre visibles, tots els dies, "—" clicable per afegir horari
    if (employees.length === 0) {
      return (
        <div>
          {chipRow}
          <div style={{ textAlign: 'center', padding: 32 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/equip/empleats')}>
              {t('equip.empleats.afegir')}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div>
        {chipRow}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80 }}>
          {employees.map(emp => {
            const weekH = empWeeklyH[emp.id] ?? 0
            const warnEmp = hasWarning(emp.id)

            return (
              <div key={emp.id} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <EmpAvatar name={emp.name} color={emp.color} avatarUrl={emp.avatar_url} size={22} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{emp.name}</span>
                  {weekH > 0 && (
                    <span style={{ fontSize: 12, color: warnEmp ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      {weekH % 1 === 0 ? weekH : weekH.toFixed(1)}h
                      {warnEmp && <AlertTriangle size={9} style={{ color: 'var(--warning)' }} />}
                    </span>
                  )}
                </div>
                {days.map(({ iso, label }, idx) => {
                  const dayShifts = (localShifts[iso] ?? []).filter(s => s.employee_id === emp.id)
                  const absence = absenceMap[emp.id]?.[iso]
                  const isEmpty = dayShifts.length === 0 && !absence
                  return (
                    <div
                      key={iso}
                      onClick={() => { if (isEmpty && role === 'owner') handleOpenEditor(emp.id, iso) }}
                      style={{
                        display: 'flex', gap: 8, fontSize: 12,
                        paddingTop: 5, marginTop: idx === 0 ? 0 : 3,
                        borderTop: '1px solid var(--border)',
                        cursor: isEmpty && role === 'owner' ? 'pointer' : 'default',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600, minWidth: 44, flexShrink: 0 }}>
                        {label}:
                      </span>
                      {absence ? (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {t(`equip.absencies.${absence.type}` as Parameters<typeof t>[0])}
                        </span>
                      ) : isEmpty ? (
                        <span style={{ color: 'var(--border)' }}>—</span>
                      ) : (
                        <span style={{ color: 'var(--text)' }}>
                          {dayShifts.map(s => `${s.start_time}–${s.end_time}`).join(' · ')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function navigateCalendar(date: string) {
    router.push(`/equip?setmana=${getMondayISO(date)}&data=${date}&vista=dia`)
    setVista('dia')
    setDiaGantt(date)
    setMobileDay(date)
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {/* Navigation (week or day) */}
        {vista === 'setmana' ? (
          <>
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
          </>
        ) : (
          <>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '0 10px' }}
              onClick={() => navDay(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{diaGanttLabel.charAt(0).toUpperCase() + diaGanttLabel.slice(1)}</span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '0 10px' }}
              onClick={() => navDay(1)}
            >
              <ChevronRight size={16} />
            </button>
            {diaGantt !== today && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => goToDay(today)}
              >
                {t('common.avui')}
              </button>
            )}
          </>
        )}

        {/* Calendari (mòbil) */}
        <button
          className="btn btn-ghost btn-sm md:hidden"
          style={{ padding: '6px 8px', marginLeft: 'auto' }}
          onClick={() => setShowCalendar(true)}
        >
          <CalendarDays size={16} />
        </button>

        {/* Gestionar empleats */}
        <button
          className="btn btn-ghost btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => router.push('/equip/empleats')}
        >
          <Users size={14} />
          {t('equip.gestionar')}
        </button>

        {/* View toggle Setmana | Dia (hidden on mobile) */}
        <div className="hidden lg:flex" style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <button
            className={`btn btn-sm ${vista === 'setmana' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 0, border: 'none', minHeight: 32 }}
            onClick={() => switchVista('setmana')}
          >
            {t('equip.gantt.setmana')}
          </button>
          <button
            className={`btn btn-sm ${vista === 'dia' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 0, border: 'none', minHeight: 32, borderLeft: '1px solid var(--border)' }}
            onClick={() => switchVista('dia')}
          >
            {t('equip.gantt.dia')}
          </button>
        </div>

        {/* Owner actions (setmana only) */}
        {vista === 'setmana' && role === 'owner' && (
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

      {/* ── Desktop view (grid or gantt) ── */}
      <div className="hidden lg:block">
        {vista === 'setmana'
          ? <DesktopGrid />
          : <EmployeeDayGantt
              date={diaGantt}
              today={today}
              employees={employees}
              shifts={(localShifts[diaGantt] ?? []).flatMap(s => { const emp = employees.find(e => e.id === s.employee_id); return emp ? [{ ...s, employee: emp }] : [] }) as ShiftWithEmployee[]}
              absences={dayAbsences}
              warnings={warnings}
              calendarDots={calendarDots[diaGantt]}
              role={role}
              onOpenEditor={handleOpenEditor}
            />
        }
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
          onAddTram={handleAddTram}
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
      </div>

      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:block w-52 shrink-0">
        <div className="card sticky top-0" style={{ maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
            {t('avui.calendari')}
          </p>
          <MiniCalendar
            dots={calendarDots}
            selectedDate={monday}
            startMonth={{ year: new Date().getFullYear(), month: new Date().getMonth() }}
            navigate={navigateCalendar}
          />
        </div>
      </aside>

      {/* ── Bottom sheet mòbil ── */}
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
              value={monday}
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
