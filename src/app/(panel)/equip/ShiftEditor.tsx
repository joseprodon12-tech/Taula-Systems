'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import type { Shift, Employee, WeeklyHours } from '@/db/schema'

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

export default function ShiftEditor({
  mode, employeeId, date, shift, employees, roleLabels, weeklyHours,
  fieldErrors, isPending, onSave, onDelete, onClose, isMobile,
}: Props) {
  const { t } = useT()
  const defaults = defaultTimes(date, weeklyHours)

  const [empId, setEmpId] = useState(shift?.employee_id ?? employeeId)
  const [start, setStart] = useState(shift?.start_time ?? defaults.start)
  const [end, setEnd] = useState(shift?.end_time ?? defaults.end)
  const [zone, setZone] = useState(shift?.zone ?? '')
  const [notes, setNotes] = useState(shift?.notes ?? '')

  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ employee_id: empId, date, start_time: start, end_time: end, zone, notes })
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
        zIndex: 60, width: 360,
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

      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
            {mode === 'new' ? t('equip.torn.nou') : t('equip.torn.editar')}
          </span>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '0 8px', minHeight: 32 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Employee selector (only for new shifts — in existing shifts it's already assigned) */}
          {mode === 'new' && (
            <div>
              <label className="label">{t('equip.empleats.nom')}</label>
              <select
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
          )}

          {/* Employee name (display only in edit mode) */}
          {mode === 'edit' && emp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: emp.color, flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{emp.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{date}</span>
            </div>
          )}

          {/* Times */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              />
            </div>
          </div>

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
              placeholder={t('reserva.camps.notesPlaceholder')}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isPending}>
              {t('reserva.guardar')}
            </button>
            {onDelete && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ minHeight: 40 }}
                onClick={onDelete}
                disabled={isPending}
                title={t('equip.torn.eliminar')}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  )
}
