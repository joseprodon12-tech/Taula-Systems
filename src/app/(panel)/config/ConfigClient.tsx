'use client'

import { useState, useTransition, useMemo, type CSSProperties } from 'react'
import { Trash2, Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import DatePicker from '@/components/DatePicker'
import { Toast, useToast } from '@/components/ui/Toast'
import {
  saveRestaurantInfo, saveWeeklyHours, saveCapacity, saveDurations,
  addClosure, removeClosure,
} from '@/app/actions/config'
import { createTable, updateTable, deleteTable } from '@/app/actions/tables'
import type { Restaurant, Closure, Table, WeeklyHours, DayHours } from '@/db/schema'
import { useT } from '@/context/LocaleContext'

// ── iOS-style layout constants ──
const sTitle: CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--text-muted)',
  padding: '0 4px 5px', marginTop: 28,
}
const card: CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid var(--border)',
}
const row: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 16px', minHeight: 48,
}
const divider: CSSProperties = { height: 1, background: 'var(--border)', margin: '0 16px' }
const lbl: CSSProperties = { fontSize: 15, color: 'var(--text)', flexShrink: 0 }
const inputRight: CSSProperties = {
  border: 'none', background: 'transparent', outline: 'none',
  textAlign: 'right', color: 'var(--text)', fontSize: 15, width: '55%',
}
const stepBtn: CSSProperties = {
  width: 30, height: 30, borderRadius: 15, border: '1px solid var(--border)',
  background: 'var(--surface)', cursor: 'pointer', fontSize: 18, lineHeight: '1',
  color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}
const iconBtn: CSSProperties = { padding: 4, background: 'none', border: 'none', cursor: 'pointer' }

interface Props {
  restaurant: Restaurant
  closures: Closure[]
  tables: Table[]
}

export default function ConfigClient({ restaurant, closures: initialClosures, tables: initialTables }: Props) {
  const { toast, show, hide } = useToast()
  const { t, locale, changeLocale } = useT()
  const [isPending, startTransition] = useTransition()

  // ── Restaurant info ──
  const [info, setInfo] = useState({
    name:             restaurant.name ?? '',
    phone:            restaurant.phone ?? '',
    email:            restaurant.email ?? '',
    address:          restaurant.address ?? '',
    city:             restaurant.city ?? '',
    slug:             restaurant.slug ?? '',
    welcome_message:  restaurant.welcome_message ?? '',
    whatsapp_number:  restaurant.whatsapp_number ?? '',
  })
  const [infoChanged, setInfoChanged] = useState(false)

  function handleInfoChange(field: keyof typeof info, value: string) {
    setInfo(prev => ({ ...prev, [field]: value }))
    setInfoChanged(true)
  }

  function saveInfo() {
    startTransition(async () => {
      try {
        await saveRestaurantInfo(restaurant.id, info)
        setInfoChanged(false)
        show('Informació guardada', 'success')
      } catch { show('Error en guardar', 'error') }
    })
  }

  // ── Weekly hours ──
  const [hours, setHours] = useState<WeeklyHours>(() => restaurant.weekly_hours as WeeklyHours || {})
  const [hoursChanged, setHoursChanged] = useState(false)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  function setDayHours(dayKey: string, updates: Partial<DayHours>) {
    setHours(prev => ({ ...prev, [dayKey]: { ...(prev[dayKey] || {}), ...updates } }))
    setHoursChanged(true)
  }
  function toggleClosed(dayKey: string, closed: boolean) {
    setHours(prev => ({ ...prev, [dayKey]: closed ? { closed: true } : { lunch: ['13:00', '16:00'] } }))
    setHoursChanged(true)
  }
  function saveHours() {
    startTransition(async () => {
      try {
        await saveWeeklyHours(restaurant.id, hours)
        setHoursChanged(false)
        show('Horari guardat', 'success')
      } catch { show('Error en guardar', 'error') }
    })
  }

  // ── Durades ──
  const [lunchDuration, setLunchDuration] = useState(restaurant.default_duration_lunch_min)
  const [dinnerDuration, setDinnerDuration] = useState(restaurant.default_duration_dinner_min)
  const [durationsChanged, setDurationsChanged] = useState(false)

  function adjustDuration(shift: 'lunch' | 'dinner', delta: number) {
    if (shift === 'lunch') setLunchDuration(v => Math.min(240, Math.max(30, v + delta)))
    else setDinnerDuration(v => Math.min(240, Math.max(30, v + delta)))
    setDurationsChanged(true)
  }
  function saveDurationData() {
    startTransition(async () => {
      try {
        await saveDurations(restaurant.id, lunchDuration, dinnerDuration)
        setDurationsChanged(false)
        show('Durades guardades', 'success')
      } catch { show('Error en guardar', 'error') }
    })
  }

  // ── Capacity ──
  const [capacity, setCapacity] = useState({
    indoor:  restaurant.capacity_indoor ?? 30,
    outdoor: restaurant.capacity_outdoor ?? 0,
  })
  const [capChanged, setCapChanged] = useState(false)

  function saveCapacityData() {
    startTransition(async () => {
      try {
        await saveCapacity(restaurant.id, capacity.indoor, capacity.outdoor)
        setCapChanged(false)
        show('Capacitat guardada', 'success')
      } catch { show('Error en guardar', 'error') }
    })
  }

  // ── Closures ──
  const [closureList, setClosureList] = useState<Closure[]>(initialClosures)
  const [newDate, setNewDate] = useState('')
  const [newReason, setNewReason] = useState('')

  function handleAddClosure() {
    if (!newDate) return
    startTransition(async () => {
      try {
        await addClosure(restaurant.id, newDate, newReason)
        const fresh = await import('@/app/actions/config').then(m => m.getClosures(restaurant.id))
        setClosureList(fresh)
        setNewDate('')
        setNewReason('')
        show('Dia tancat afegit', 'success')
      } catch { show('Error en afegir', 'error') }
    })
  }
  function handleRemoveClosure(id: string) {
    startTransition(async () => {
      try {
        await removeClosure(id)
        setClosureList(prev => prev.filter(c => c.id !== id))
      } catch { show('Error en eliminar', 'error') }
    })
  }

  // ── Tables ──
  const [tableList, setTableList] = useState<Table[]>(initialTables)
  const [deleteTableId, setDeleteTableId] = useState<string | null>(null)
  const [tableSheet, setTableSheet] = useState<{
    mode: 'add'; section: 'indoor' | 'outdoor'
  } | { mode: 'edit'; table: Table } | null>(null)
  const [tableForm, setTableForm] = useState({ number: '', section: 'indoor' as 'indoor' | 'outdoor', capacity: 2 })

  function openAddSheet(section: 'indoor' | 'outdoor') {
    setTableForm({ number: '', section, capacity: 2 })
    setTableSheet({ mode: 'add', section })
  }
  function openEditSheet(table: Table) {
    setTableForm({ number: table.number, section: table.section, capacity: table.capacity })
    setTableSheet({ mode: 'edit', table })
  }
  function handleSaveTable() {
    startTransition(async () => {
      if (!tableSheet) return
      if (tableSheet.mode === 'add') {
        const result = await createTable(restaurant.id, tableForm)
        if ('error' in result) { show(result.error, 'error'); return }
        const fresh = await import('@/app/actions/tables').then(m => m.getTables(restaurant.id))
        setTableList(fresh)
      } else {
        const result = await updateTable(tableSheet.table.id, tableForm)
        if ('error' in result) { show(result.error, 'error'); return }
        setTableList(prev => prev.map(t => t.id === tableSheet.table.id ? { ...t, ...tableForm } : t))
      }
      setTableSheet(null)
    })
  }
  function confirmDeleteTable() {
    if (!deleteTableId) return
    const id = deleteTableId
    setDeleteTableId(null)
    startTransition(async () => {
      const result = await deleteTable(id)
      if ('error' in result) { show(result.error, 'error'); return }
      setTableList(prev => prev.filter(t => t.id !== id))
    })
  }

  const indoorTables  = tableList.filter(t => t.section === 'indoor')
  const outdoorTables = tableList.filter(t => t.section === 'outdoor')

  const DAYS = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 0, 5 + i) // Jan 5 2026 = Monday
      const key = i < 6 ? String(i + 1) : '0'
      const name = new Intl.DateTimeFormat(locale === 'ca' ? 'ca' : 'es', { weekday: 'long' }).format(d)
      return { key, label: name.charAt(0).toUpperCase() + name.slice(1) }
    })
  , [locale])

  return (
    <div style={{ background: '#F2F2F7', margin: '-24px -16px -32px', padding: '24px 16px 48px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('config.titol')}</h1>

      {/* IDIOMA */}
      <p style={sTitle}>{t('config.idioma')}</p>
      <div style={card}>
        <div style={row}>
          <span style={lbl}>{t('config.idioma')}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['ca', 'es'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => changeLocale(lang)}
                style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                  background: locale === lang ? 'var(--primary)' : 'var(--surface)',
                  color: locale === lang ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                {t(`config.idiomes.${lang}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RESTAURANT */}
      <p style={sTitle}>{t('config.seccions.restaurant')}</p>
      <div style={card}>
        {([
          { field: 'name'    as const, label: t('config.info.nom'),     placeholder: 'Can Jordi',           type: 'text'  },
          { field: 'phone'   as const, label: t('config.info.telefon'), placeholder: '93 000 00 00',        type: 'tel'   },
          { field: 'email'   as const, label: 'Email',                  placeholder: 'hola@restaurant.com', type: 'email' },
          { field: 'address' as const, label: t('config.info.adreca'),  placeholder: 'Carrer Major, 1',     type: 'text'  },
        ]).map(({ field, label, placeholder, type }, idx) => (
          <div key={field}>
            {idx > 0 && <div style={divider} />}
            <div style={row}>
              <span style={lbl}>{label}</span>
              <input
                type={type}
                value={info[field]}
                placeholder={placeholder}
                onChange={e => handleInfoChange(field, e.target.value)}
                style={inputRight}
              />
            </div>
          </div>
        ))}
        <div style={divider} />
        <div style={{ ...row, gap: 8 }}>
          <span style={{ ...lbl }}>{t('config.info.url')}</span>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginRight: 2 }}>taula.systems/r/</span>
            <input
              value={info.slug}
              placeholder="can-jordi"
              onChange={e => handleInfoChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              style={{ ...inputRight, width: 100 }}
            />
          </div>
        </div>
        {infoChanged && (
          <>
            <div style={divider} />
            <div style={{ padding: '12px 16px' }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveInfo} disabled={isPending}>
                Guardar informació
              </button>
            </div>
          </>
        )}
      </div>

      {/* HORARIS */}
      <p style={sTitle}>{t('config.seccions.horaris')}</p>
      <div style={card}>
        {DAYS.map(({ key, label }, idx) => {
          const day: DayHours = hours[key] || {}
          const isClosed = !!day.closed
          const isExpanded = expandedDay === key
          return (
            <div key={key}>
              {idx > 0 && <div style={divider} />}
              <div style={{ ...row, cursor: 'pointer' }} onClick={() => setExpandedDay(isExpanded ? null : key)}>
                <span style={lbl}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: isClosed ? 'var(--text-muted)' : '#10B981' }}>
                    {isClosed ? t('config.horaris.tancat') : t('config.horaris.obert')}
                  </span>
                  {isExpanded
                    ? <ChevronDown size={15} color="var(--text-muted)" />
                    : <ChevronRight size={15} color="var(--text-muted)" />
                  }
                </div>
              </div>
              {isExpanded && (
                <div style={{ padding: '12px 16px', background: '#F8FAFC', borderTop: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!isClosed}
                      onChange={e => toggleClosed(key, !e.target.checked)}
                      style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>{t('config.horaris.obertDia')}</span>
                  </label>
                  {!isClosed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
                      <ShiftRow
                        label={t('avui.dinar')}
                        fins={t('config.horaris.fins')}
                        value={day.lunch}
                        enabled={!!day.lunch}
                        onToggle={en => setDayHours(key, { lunch: en ? ['13:00', '16:00'] : undefined })}
                        onChange={v => setDayHours(key, { lunch: v })}
                      />
                      <ShiftRow
                        label={t('avui.sopar')}
                        fins={t('config.horaris.fins')}
                        value={day.dinner}
                        enabled={!!day.dinner}
                        onToggle={en => setDayHours(key, { dinner: en ? ['20:00', '23:00'] : undefined })}
                        onChange={v => setDayHours(key, { dinner: v })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {hoursChanged && (
          <>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <div style={{ padding: '12px 16px' }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveHours} disabled={isPending}>
                Guardar horari
              </button>
            </div>
          </>
        )}
      </div>

      {/* TAULES */}
      <p style={sTitle}>{t('config.taules.titol')}</p>
      <div style={card}>
        <TableGroup
          title={t('config.taules.sala')}
          tables={indoorTables}
          onEdit={openEditSheet}
          onDelete={setDeleteTableId}
          onAdd={() => openAddSheet('indoor')}
          isPending={isPending}
          placesLabel={t('config.taules.places')}
        />
        {restaurant.capacity_outdoor > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <TableGroup
              title={t('config.taules.terrassa')}
              tables={outdoorTables}
              onEdit={openEditSheet}
              onDelete={setDeleteTableId}
              onAdd={() => openAddSheet('outdoor')}
              isPending={isPending}
              placesLabel={t('config.taules.places')}
            />
          </>
        )}
      </div>

      {/* CAPACITAT */}
      <p style={sTitle}>{t('config.seccions.capacitat')}</p>
      <div style={card}>
        <div style={row}>
          <span style={lbl}>{t('config.taules.sala')}</span>
          <input
            type="number" min={0} max={999}
            value={capacity.indoor}
            onChange={e => { setCapacity(p => ({ ...p, indoor: +e.target.value })); setCapChanged(true) }}
            style={{ ...inputRight, width: 60 }}
          />
        </div>
        <div style={divider} />
        <div style={row}>
          <span style={lbl}>{t('config.taules.terrassa')}</span>
          <input
            type="number" min={0} max={999}
            value={capacity.outdoor}
            onChange={e => { setCapacity(p => ({ ...p, outdoor: +e.target.value })); setCapChanged(true) }}
            style={{ ...inputRight, width: 60 }}
          />
        </div>
        {capChanged && (
          <>
            <div style={divider} />
            <div style={{ padding: '12px 16px' }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveCapacityData} disabled={isPending}>
                Guardar capacitat
              </button>
            </div>
          </>
        )}
      </div>

      {/* DURADES */}
      <p style={sTitle}>{t('config.durades.titol')}</p>
      <div style={card}>
        <div style={row}>
          <span style={lbl}>{t('config.durades.dinar')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" style={stepBtn} onClick={() => adjustDuration('lunch', -15)}>−</button>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', minWidth: 58, textAlign: 'center' }}>
              {lunchDuration} {t('config.durades.unitat')}
            </span>
            <button type="button" style={stepBtn} onClick={() => adjustDuration('lunch', 15)}>+</button>
          </div>
        </div>
        <div style={divider} />
        <div style={row}>
          <span style={lbl}>{t('config.durades.sopar')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" style={stepBtn} onClick={() => adjustDuration('dinner', -15)}>−</button>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', minWidth: 58, textAlign: 'center' }}>
              {dinnerDuration} {t('config.durades.unitat')}
            </span>
            <button type="button" style={stepBtn} onClick={() => adjustDuration('dinner', 15)}>+</button>
          </div>
        </div>
        {durationsChanged && (
          <>
            <div style={divider} />
            <div style={{ padding: '12px 16px' }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveDurationData} disabled={isPending}>
                Guardar durades
              </button>
            </div>
          </>
        )}
      </div>

      {/* DIES TANCATS */}
      <p style={sTitle}>{t('config.seccions.tancats')}</p>
      <div style={card}>
        {closureList.map((c, idx) => (
          <div key={c.id}>
            {idx > 0 && <div style={divider} />}
            <div style={row}>
              <div>
                <span style={{ fontSize: 15, color: 'var(--text)' }}>{formatDate(c.date, locale)}</span>
                {c.reason && <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>{c.reason}</span>}
              </div>
              <button type="button" onClick={() => handleRemoveClosure(c.id)} disabled={isPending} style={{ ...iconBtn, color: '#EF4444' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {closureList.length > 0 && <div style={{ height: 1, background: 'var(--border)' }} />}
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
          <DatePicker
            value={newDate}
            onChange={setNewDate}
            dropUp
            style={{ flex: 1 }}
          />
          <input
            className="input"
            placeholder={t('config.tancats.motiu')}
            value={newReason}
            onChange={e => setNewReason(e.target.value)}
            style={{ flex: 2 }}
          />
          <button className="btn btn-secondary" onClick={handleAddClosure} disabled={!newDate || isPending}>
            <Plus size={15} />
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}

      {/* ── Bottom sheet: Confirmar eliminació de taula ── */}
      {deleteTableId && (
        <>
          <div onClick={() => setDeleteTableId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'var(--bg)', borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}>
            <p className="font-bold mb-2" style={{ color: 'var(--text)', fontSize: 17 }}>{t('config.taules.eliminar')}</p>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              {t('config.taules.eliminarConfirm')}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteTableId(null)}>Cancel·lar</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmDeleteTable} disabled={isPending}>{t('config.taules.eliminar')}</button>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom sheet: Afegir / Editar taula ── */}
      {tableSheet && (
        <>
          <div onClick={() => setTableSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'var(--bg)', borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}>
            <p className="font-bold mb-4" style={{ color: 'var(--text)', fontSize: 17 }}>
              {tableSheet.mode === 'add' ? t('config.taules.afegir') : t('config.taules.editar')}
            </p>
            <div className="space-y-4">
              <label style={{ display: 'block' }}>
                <span className="label">{t('config.taules.numeroNom')}</span>
                <input
                  className="input"
                  placeholder="T-1, Barra, Terrassa 3..."
                  value={tableForm.number}
                  onChange={e => setTableForm(f => ({ ...f, number: e.target.value }))}
                  autoFocus
                />
              </label>
              <label style={{ display: 'block' }}>
                <span className="label">{t('config.taules.seccioLabel')}</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {(['indoor', 'outdoor'] as const).map(s => (
                    <button
                      key={s} type="button"
                      className={`btn btn-sm ${tableForm.section === s ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setTableForm(f => ({ ...f, section: s }))}
                    >
                      {s === 'indoor' ? t('config.taules.sala') : t('config.taules.terrassa')}
                    </button>
                  ))}
                </div>
              </label>
              <label style={{ display: 'block' }}>
                <span className="label">{t('config.taules.capacitatLabel')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ minWidth: 44, minHeight: 44 }} onClick={() => setTableForm(f => ({ ...f, capacity: Math.max(1, f.capacity - 1) }))}>−</button>
                  <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 600, fontSize: 18 }}>{tableForm.capacity}</span>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ minWidth: 44, minHeight: 44 }} onClick={() => setTableForm(f => ({ ...f, capacity: Math.min(20, f.capacity + 1) }))}>+</button>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('config.taules.places')}</span>
                </div>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setTableSheet(null)}>Cancel·lar</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveTable} disabled={isPending || !tableForm.number.trim()}>
                {tableSheet.mode === 'add' ? t('config.taules.afegir') : t('config.taules.editar')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ──

function TableGroup({ title, tables, onEdit, onDelete, onAdd, isPending, placesLabel }: {
  title: string
  tables: Table[]
  onEdit: (t: Table) => void
  onDelete: (id: string) => void
  onAdd: () => void
  isPending: boolean
  placesLabel: string
}) {
  return (
    <div>
      <div style={{ padding: '8px 16px 2px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {title}
        </span>
      </div>
      {tables.map(tbl => (
        <div key={tbl.id}>
          <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', minHeight: 48 }}>
            <span style={{ fontSize: 15, color: 'var(--text)' }}>{tbl.number}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{tbl.capacity} {placesLabel}</span>
              <button type="button" onClick={() => onEdit(tbl)} disabled={isPending} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => onDelete(tbl.id)} disabled={isPending} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
      <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />
      <button
        type="button"
        onClick={onAdd}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 15 }}
      >
        <Plus size={15} />
        Afegir taula
      </button>
    </div>
  )
}

function ShiftRow({ label, fins, value, enabled, onToggle, onChange }: {
  label: string
  fins: string
  value?: [string, string]
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onChange: (v: [string, string]) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onToggle(e.target.checked)}
          style={{ accentColor: 'var(--primary)' }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-muted)', width: 46 }}>{label}</span>
      </label>
      {enabled && (
        <>
          <input
            className="input" type="time"
            value={value?.[0] ?? '13:00'}
            onChange={e => onChange([e.target.value, value?.[1] ?? '16:00'])}
            style={{ minHeight: 40, padding: '0 8px', fontSize: 13, flex: 1 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fins}</span>
          <input
            className="input" type="time"
            value={value?.[1] ?? '16:00'}
            onChange={e => onChange([value?.[0] ?? '13:00', e.target.value])}
            style={{ minHeight: 40, padding: '0 8px', fontSize: 13, flex: 1 }}
          />
        </>
      )}
    </div>
  )
}

function formatDate(dateStr: string, locale: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}
