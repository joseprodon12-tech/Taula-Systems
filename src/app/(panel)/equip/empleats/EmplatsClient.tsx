'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import type { Employee } from '@/db/schema'
import {
  createEmployee, updateEmployee,
  deactivateEmployee, reactivateEmployee,
} from '@/app/actions/equip'
import { Toast, useToast } from '@/components/ui/Toast'

// 8 colors harmònics amb el tema ambre
const PALETTE = [
  '#D97706', '#0EA5E9', '#10B981', '#8B5CF6',
  '#F43F5E', '#F97316', '#14B8A6', '#6366F1',
]

interface Props {
  employees: Employee[]
  role: 'owner' | 'staff'
}

type FormData = {
  name: string; role_label: string; color: string
  phone: string; contract_hours_week: string
}

const EMPTY_FORM: FormData = { name: '', role_label: '', color: PALETTE[0], phone: '', contract_hours_week: '' }
const ROLE_SUGGESTIONS = ['Sala', 'Cuina', 'Barra']

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export default function EmplatsClient({ employees: initial, role }: Props) {
  const { t } = useT()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [employees, setEmployees] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const active = employees.filter(e => e.active)
  const inactive = employees.filter(e => !e.active)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setShowForm(true)
  }

  function openEdit(emp: Employee) {
    if (role !== 'owner') return
    setEditingId(emp.id)
    setForm({
      name: emp.name,
      role_label: emp.role_label,
      color: emp.color,
      phone: emp.phone ?? '',
      contract_hours_week: emp.contract_hours_week != null ? String(emp.contract_hours_week) : '',
    })
    setFieldErrors({})
    setShowForm(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = {
      name: form.name,
      role_label: form.role_label,
      color: form.color,
      phone: form.phone || undefined,
      contract_hours_week: form.contract_hours_week ? Number(form.contract_hours_week) : undefined,
    }

    if (editingId) {
      startTransition(async () => {
        const res = await updateEmployee(editingId, {
          name: data.name,
          role_label: data.role_label,
          color: data.color,
          phone: data.phone ?? null,
          contract_hours_week: data.contract_hours_week ?? null,
        })
        if ('error' in res) { showToast(res.error, 'error'); return }
        setEmployees(prev => prev.map(e =>
          e.id === editingId
            ? { ...e, name: data.name, role_label: data.role_label, color: data.color,
                phone: data.phone ?? null, contract_hours_week: data.contract_hours_week ?? null }
            : e
        ))
        setShowForm(false)
        showToast(t('reserva.missatges.guardada'), 'success')
      })
    } else {
      startTransition(async () => {
        const res = await createEmployee(data)
        if ('error' in res) {
          setFieldErrors((res as { fieldErrors?: Record<string, string> }).fieldErrors ?? {})
          showToast(res.error, 'error')
          return
        }
        const newEmp: Employee = {
          id: (res as { id: string }).id,
          restaurant_id: '',
          name: data.name,
          role_label: data.role_label,
          color: data.color,
          phone: data.phone ?? null,
          contract_hours_week: data.contract_hours_week ?? null,
          sort_order: employees.length,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setEmployees(prev => [...prev, newEmp])
        setShowForm(false)
        setForm(EMPTY_FORM)
        showToast(t('reserva.missatges.guardada'), 'success')
      })
    }
  }

  function handleDeactivate(id: string) {
    setConfirmDeactivate(null)
    startTransition(async () => {
      const res = await deactivateEmployee(id)
      if ('error' in res) { showToast(res.error, 'error'); return }
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, active: false } : e))
    })
  }

  function handleReactivate(id: string) {
    startTransition(async () => {
      const res = await reactivateEmployee(id)
      if ('error' in res) { showToast(res.error, 'error'); return }
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, active: true } : e))
    })
  }

  function EmployeeCard({ emp }: { emp: Employee }) {
    return (
      <div
        className="card"
        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: role === 'owner' ? 'pointer' : 'default' }}
        onClick={() => openEdit(emp)}
      >
        <span style={{
          width: 28, height: 28, borderRadius: '50%', background: emp.color, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'white', userSelect: 'none',
        }}>{getInitials(emp.name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{emp.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {emp.role_label}
            {emp.contract_hours_week != null && ` · ${emp.contract_hours_week}h/setm.`}
          </div>
        </div>
        {role === 'owner' && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '0 8px' }}
            onClick={e => { e.stopPropagation(); setConfirmDeactivate(emp.id) }}
            title={t('equip.empleats.desactivar')}
          >
            ✕
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '0 8px' }}
              onClick={() => router.push('/equip')}
              title="← Equip"
            >
              <ArrowLeft size={16} />
            </button>
            <Users size={18} style={{ color: 'var(--primary)' }} />
            <h1 className="section-title" style={{ marginBottom: 0 }}>{t('equip.empleats.titol')}</h1>
          </div>
          {role === 'owner' && !showForm && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <Plus size={14} />{t('equip.empleats.afegir')}
            </button>
          )}
        </div>

        {/* Create/Edit form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>
              {editingId ? t('equip.empleats.editar') : t('equip.empleats.afegir')}
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Nom */}
              <div>
                <label className="label">{t('equip.empleats.nom')}</label>
                <input
                  type="text"
                  className="input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                  style={fieldErrors.name ? { borderColor: 'var(--state-noshow)' } : {}}
                />
                {fieldErrors.name && <span style={{ fontSize: 12, color: 'var(--state-noshow)' }}>{fieldErrors.name}</span>}
              </div>

              {/* Rol */}
              <div>
                <label className="label">{t('equip.empleats.rol')}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {ROLE_SUGGESTIONS.map(rl => (
                    <button
                      key={rl}
                      type="button"
                      className={`btn btn-sm ${form.role_label === rl ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setForm(f => ({ ...f, role_label: rl }))}
                    >
                      {rl}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="input"
                  value={form.role_label}
                  onChange={e => setForm(f => ({ ...f, role_label: e.target.value }))}
                  placeholder="Sala, Cuina, Barra..."
                  required
                  style={fieldErrors.role_label ? { borderColor: 'var(--state-noshow)' } : {}}
                />
                {fieldErrors.role_label && <span style={{ fontSize: 12, color: 'var(--state-noshow)' }}>{fieldErrors.role_label}</span>}
              </div>

              {/* Color */}
              <div>
                <label className="label">{t('equip.empleats.color')}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', background: c,
                        border: form.color === c ? '3px solid var(--text)' : '2px solid transparent',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Telèfon (opcional) */}
              <div>
                <label className="label">
                  {t('equip.empleats.telefon')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('reserva.camps.opcional')}</span>
                </label>
                <input
                  type="tel"
                  className="input"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>

              {/* Hores contracte (opcional) */}
              <div>
                <label className="label">
                  {t('equip.empleats.horesContracte')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{t('reserva.camps.opcional')}</span>
                </label>
                <input
                  type="number"
                  className="input"
                  value={form.contract_hours_week}
                  onChange={e => setForm(f => ({ ...f, contract_hours_week: e.target.value }))}
                  min={0}
                  max={168}
                  step={0.5}
                  placeholder="40"
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isPending}>
                  {editingId ? t('equip.empleats.guardar') : t('equip.empleats.crear')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={isPending}>
                  {t('reserva.tornar')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active employees */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {active.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
          {active.length === 0 && !showForm && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, fontSize: 14 }}>
              {role === 'owner'
                ? t('equip.empleats.afegir') + ' per començar'
                : t('avui.sense')
              }
            </div>
          )}
        </div>

        {/* Inactive section */}
        {inactive.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowInactive(v => !v)}
              style={{ marginBottom: 8 }}
            >
              {showInactive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Desactivats ({inactive.length})
            </button>
            {showInactive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {inactive.map(emp => (
                  <div key={emp.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.6 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%', background: emp.color, flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'white', userSelect: 'none',
                    }}>{getInitials(emp.name)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{emp.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.role_label}</div>
                    </div>
                    {role === 'owner' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleReactivate(emp.id)}
                        disabled={isPending}
                      >
                        {t('equip.empleats.reactivar')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm deactivate bottom sheet */}
      {confirmDeactivate && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,0.3)' }}
            onClick={() => setConfirmDeactivate(null)}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
            background: 'var(--bg)', borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0', padding: 24, paddingBottom: 40,
          }}>
            <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 20 }}>
              {t('equip.empleats.confirmDesactivar')}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => handleDeactivate(confirmDeactivate)}
                disabled={isPending}
              >
                {t('equip.empleats.desactivar')}
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setConfirmDeactivate(null)}
              >
                {t('reserva.confirmCancellar.mantenir')}
              </button>
            </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </>
  )
}
