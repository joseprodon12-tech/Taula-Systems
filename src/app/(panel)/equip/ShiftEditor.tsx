'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Trash2, Plus } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import { toMin } from '@/lib/labor'
import type { Shift, Employee, WeeklyHours } from '@/db/schema'
import EmpAvatar from '@/components/ui/EmpAvatar'

export interface ShiftFormData {
  employee_id: string
  date: string
  start_time: string
  end_time: string
  zone: string
  notes: string
}

interface Props {
  mode: 'new' | 'edit'
  employeeId: string
  date: string
  shift?: Shift
  employees: Employee[]
  roleLabels: string[]
  weeklyHours: WeeklyHours
  fieldErrors?: Record<string, string>
  isPending: boolean
  onSave: (data: ShiftFormData) => void
  onDelete?: () => void
  onAddTram?: () => void
  onClose: () => void
  isMobile: boolean
}

function defaultTimes(date: string, wh: WeeklyHours): { start: string; end: string } {
  const [y, m, d] = date.split('-').map(Number)
  const key = String(new Date(y, m - 1, d).getDay())
  const day = wh[key]
  if (!day || day.closed) return { start: '', end: '' }
  const svc = day.dinner ?? day.lunch
  if (!svc) return { start: '', end: '' }
  return { start: svc[0], end: svc[1] }
}

function formatDay(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(locale === 'ca' ? 'ca' : 'es', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(y, m - 1, d))
}

export default function ShiftEditor({
  mode, employeeId, date, shift, employees, roleLabels, weeklyHours,
  fieldErrors, isPending, onSave, onDelete, onAddTram, onClose, isMobile,
}: Props) {
  const { t, locale } = useT()
  const defaults = defaultTimes(date, weeklyHours)

  const [empId, setEmpId] = useState(shift?.employee_id ?? employeeId)
  const [shiftDate, setShiftDate] = useState(date)
  const [start, setStart] = useState(shift?.start_time ?? defaults.start)
  const [end, setEnd] = useState(shift?.end_time ?? defaults.end)
  const [zone, setZone] = useState(shift?.zone ?? '')
  const [notes, setNotes] = useState(shift?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Punt 6: hores habituals del restaurant per a selecció ràpida
  const suggestedTimes = useMemo(() => {
    const times = new Set<string>()
    for (const day of Object.values(weeklyHours)) {
      if (!day || day.closed) continue
      if (day.lunch) { times.add(day.lunch[0]); times.add(day.lunch[1]) }
      if (day.dinner) { times.add(day.dinner[0]); times.add(day.dinner[1]) }
    }
    return [...times].sort()
  }, [weeklyHours])

  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Hores iguals no són un torn de 24 h; un final anterior a l'inici sí que és un torn que passa mitjanit
  const sameTimes = !!start && start === end
  const overnight = !!start && !!end && toMin(end) < toMin(start)
  const minutes = start && end && !sameTimes
    ? (overnight ? toMin(end) + 1440 - toMin(start) : toMin(end) - toMin(start))
    : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sameTimes) return
    onSave({ employee_id: empId, date: shiftDate, start_time: start, end_time: end, zone, notes })
  }

  const emp = employees.find(e => e.id === empId)

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
        background: 'var(--bg)', borderTop: '1px solid var(--border)',
        borderRadius: '16px 16px 0 0', padding: 20, paddingBottom: 32,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      }
    : {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 60, width: 440,
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20,
        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
      }

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      <div className="team-shift-editor" style={panelStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
            {mode === 'new' ? t('equip.torn.nou') : t('equip.torn.editar')}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {formatDay(shiftDate, locale)}</span>
          </span>
          <button onClick={onClose} aria-label={locale === 'ca' ? 'Tancar' : 'Cerrar'} className="btn btn-ghost btn-sm" style={{ padding: '0 8px', minHeight: 44 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Employee selector (only for new shifts — in existing shifts it's already assigned) */}
          {mode === 'new' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
              <div>
                <label className="label" htmlFor="shift-employee">{t('equip.empleats.empleat')}</label>
                <select
                  id="shift-employee"
                  className="input"
                  value={empId}
                  onChange={e => setEmpId(e.target.value)}
                  required
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="shift-date">{t('equip.torn.dia')}</label>
                <input
                  id="shift-date"
                  type="date"
                  className="input"
                  value={shiftDate}
                  onChange={e => setShiftDate(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Employee name (display only in edit mode) */}
          {mode === 'edit' && emp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <EmpAvatar name={emp.name} color={emp.color} avatarUrl={emp.avatar_url} size={22} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{emp.name}</span>
            </div>
          )}

          {/* Times */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
            <div>
              <label className="label">{t('equip.torn.inici')}</label>
              <input
                type="time"
                className="input"
                value={start}
                onChange={e => setStart(e.target.value)}
                required
                style={fieldErrors?.start_time ? { borderColor: 'var(--state-noshow)' } : {}}
              />
              {fieldErrors?.start_time && (
                <span style={{ fontSize: 12, color: 'var(--state-noshow)', marginTop: 4, display: 'block' }}>
                  {t('equip.torn.solapat')}
                </span>
              )}
            </div>
            <div>
              <label className="label">{t('equip.torn.fi')}</label>
              <input
                type="time"
                className="input"
                value={end}
                onChange={e => setEnd(e.target.value)}
                required
                style={fieldErrors?.end_time || sameTimes ? { borderColor: 'var(--state-noshow)' } : {}}
              />
              {fieldErrors?.end_time && !sameTimes && (
                <span style={{ fontSize: 12, color: 'var(--state-noshow)', marginTop: 4, display: 'block' }}>
                  {fieldErrors.end_time}
                </span>
              )}
            </div>
          </div>

          {sameTimes ? (
            <p role="alert" style={{ fontSize: 13, fontWeight: 600, color: 'var(--state-noshow)', marginTop: -8 }}>
              {t('equip.torn.iguals')}
            </p>
          ) : minutes !== null && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8 }}>
              {t('equip.torn.durada')}:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {Math.floor(minutes / 60)} h{minutes % 60 ? ` ${minutes % 60} min` : ''}
              </strong>
              {overnight && <> · {t('equip.torn.acabaEndema')}</>}
            </p>
          )}

          {/* Punt 6: píndoles d'hores habituals del restaurant */}
          {suggestedTimes.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: -4 }}>
              {suggestedTimes.map(time => {
                const isSelected = start === time || end === time
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => {
                      if (!start) setStart(time)
                      else if (!end || start === time) setEnd(time)
                      else setStart(time)
                    }}
                    style={{
                      padding: '8px 12px', minHeight: 44, borderRadius: 9, fontSize: 13, fontWeight: 600,
                      border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      color: isSelected ? 'white' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {time}
                  </button>
                )
              })}
            </div>
          )}

          {/* Add second leg */}
          {onAddTram && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onAddTram}
              style={{ alignSelf: 'flex-start', gap: 4 }}
            >
              <Plus size={13} />{t('equip.torn.afegirTram')}
            </button>
          )}

          {/* Zone */}
          <div>
            <label className="label">{t('equip.torn.zona')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('reserva.camps.opcional')}</span></label>
            <select className="input" value={zone} onChange={e => setZone(e.target.value)}>
              <option value="">—</option>
              {roleLabels.map(rl => (
                <option key={rl} value={rl}>{rl}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="label">{t('equip.torn.notes')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('reserva.camps.opcional')}</span></label>
            <input
              type="text"
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('equip.torn.notesPlaceholder')}
            />
          </div>

          {/* Actions */}
          {confirmDelete ? (
            <div role="alert" style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>
                {t('equip.torn.confirmarEliminar')}{' '}
                <strong>{emp?.name} · {formatDay(shiftDate, locale)} · {start}–{end}</strong>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, minHeight: 44 }} onClick={() => setConfirmDelete(false)}>
                  {t('common.cancellar')}
                </button>
                <button type="button" className="btn btn-danger" style={{ flex: 1, minHeight: 44 }} onClick={onDelete} disabled={isPending}>
                  {t('equip.torn.eliminar')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isPending || sameTimes}>
                {t('equip.torn.guardar')}
              </button>
              {onDelete && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ minHeight: 40 }}
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                  title={t('equip.torn.eliminar')}
                  aria-label={t('equip.torn.eliminar')}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </>
  )
}
