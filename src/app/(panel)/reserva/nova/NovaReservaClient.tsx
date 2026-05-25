'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Toast, useToast } from '@/components/ui/Toast'
import TimeWheelPicker from '@/components/TimeWheelPicker'
import DatePicker from '@/components/DatePicker'
import { createReservation, updateReservation, getAvailableSlotsForDate, getReservationsForDay } from '@/app/actions/reservations'
import { useT } from '@/context/LocaleContext'
import type { Restaurant, Reservation, Table } from '@/db/schema'

interface Props {
  initialDate: string
  initialSlots: string[]
  initialTime: string
  initialTableId: string
  restaurant: Restaurant
  editReservation: Reservation | null
  tables: Table[]
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`
}

function defaultDuration(restaurant: Restaurant, time: string): number {
  const hour = parseInt(time.split(':')[0])
  return hour >= 12 && hour < 17
    ? restaurant.default_duration_lunch_min
    : restaurant.default_duration_dinner_min
}

export default function NovaReservaClient({ initialDate, initialSlots, initialTime, initialTableId, restaurant, editReservation, tables }: Props) {
  const router = useRouter()
  const { t } = useT()
  const { toast, show, hide } = useToast()
  const [pending, startTransition] = useTransition()

  const edit = editReservation
  const [date, setDate] = useState(edit?.date ?? initialDate)
  const [slots, setSlots] = useState<string[]>(initialSlots)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [time, setTime] = useState(edit?.time ?? initialTime)
  const [durationMinutes, setDurationMinutes] = useState(() => {
    if (edit?.duration_minutes) return edit.duration_minutes
    const t = edit?.time ?? initialTime
    return t ? defaultDuration(restaurant, t) : restaurant.default_duration_lunch_min
  })
  const [partySize, setPartySize] = useState(edit?.party_size ?? 2)
  const [showStepper, setShowStepper] = useState((edit?.party_size ?? 2) > 6)
  const [section, setSection] = useState<'indoor' | 'outdoor'>(edit?.section ?? 'indoor')
  const [name, setName] = useState(edit?.customer_name ?? '')
  const [phone, setPhone] = useState(edit?.customer_phone ?? '')
  const [email, setEmail] = useState(edit?.customer_email ?? '')
  const [notes, setNotes] = useState(edit?.notes ?? '')
  // Use table.id as key to avoid collisions between sections with same number.
  // For edits, match by number+section. For new from Gantt, initialTableId is already a table.id.
  const [tableId, setTableId] = useState(() => {
    if (tables.length === 0) return ''
    if (edit?.table_number)
      return tables.find(t => t.number === edit.table_number && t.section === edit.section)?.id
          ?? tables.find(t => t.number === edit.table_number)?.id
          ?? ''
    return initialTableId
  })
  // Free-text table number when no tables are configured
  const [tableText, setTableText] = useState(tables.length === 0 ? (edit?.table_number ?? '') : '')
  const [dayReservations, setDayReservations] = useState<
    { table_number: string | null; time: string; duration_minutes: number; id: string }[]
  >([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const hasOutdoor = restaurant.capacity_outdoor > 0

  function handleDateChange(newDate: string) {
    setDate(newDate)
    setTime('')
    setSlotsLoading(true)
    startTransition(async () => {
      const [newSlots, dayRes] = await Promise.all([
        getAvailableSlotsForDate(newDate),
        getReservationsForDay(restaurant.id, newDate),
      ])
      setSlots(newSlots)
      setDayReservations(dayRes.map(r => ({
        table_number: r.table_number,
        time: r.time,
        duration_minutes: r.duration_minutes,
        id: r.id,
      })))
      setSlotsLoading(false)
    })
  }

  function handleTimeSelect(selectedTime: string) {
    setTime(selectedTime)
    setDurationMinutes(defaultDuration(restaurant, selectedTime))
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    setErrors({})
    startTransition(async () => {
      const data = {
        date,
        time,
        party_size: partySize,
        section,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || undefined,
        notes: notes || undefined,
        table_number: tables.length > 0
          ? (tables.find(t => t.id === tableId)?.number || undefined)
          : (tableText || undefined),
        duration_minutes: durationMinutes,
      }

      let result
      if (edit) {
        result = await updateReservation(edit.id, data)
        if ('error' in result) {
          show(result.error, 'error')
          return
        }
        router.push(`/reserva/${edit.id}`)
      } else {
        result = await createReservation(data)
        if ('error' in result) {
          setErrors(result.fieldErrors ?? {})
          show(result.error, 'error')
          return
        }
        if (result.warning) show(result.warning, 'error')
        router.push(`/avui?data=${date}`)
      }
    })
  }

  const occupiedTableNumbers = (() => {
    if (!time || !durationMinutes) return new Set<string>()
    const [rh, rm] = time.split(':').map(Number)
    const rStart = rh * 60 + rm
    const rEnd = rStart + durationMinutes
    return new Set(
      dayReservations
        .filter(r => {
          if (edit && r.id === edit.id) return false
          if (!r.table_number) return false
          const [oh, om] = r.time.split(':').map(Number)
          const oStart = oh * 60 + om
          const oEnd = oStart + (r.duration_minutes || 90)
          return rStart < oEnd && rEnd > oStart
        })
        .map(r => r.table_number as string)
    )
  })()

  // Split slots into lunch / dinner groups
  const lunchSlots = slots.filter(s => parseInt(s) < 17)
  const dinnerSlots = slots.filter(s => parseInt(s) >= 17)
  const closed = !slotsLoading && slots.length === 0
  const endTime = time ? addMinutesToTime(time, durationMinutes) : null

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Capçalera */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => { if (window.history.length > 1) router.back(); else router.push('/avui') }}
          className="btn btn-ghost btn-sm"
          style={{ padding: '6px 8px' }}
        >
          {t('reserva.tornar')}
        </button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
          {edit ? t('reserva.editar') : t('reserva.nova')}
        </h1>
        {initialTableId && !edit && (() => {
          const t2 = tables.find(t => t.id === initialTableId)
          return t2 ? (
            <span className="badge" style={{ background: '#EEF2FF', color: 'var(--primary)', fontWeight: 600 }}>
              {t('reserva.taulaLabel')} {t2.number}
            </span>
          ) : null
        })()}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? 'none' : 'auto' }}
      >
        {/* Data */}
        <div style={{ marginBottom: 12 }}>
          <span className="label">{t('reserva.camps.data')}</span>
          <DatePicker
            value={date}
            onChange={handleDateChange}
            error={!!errors.date}
          />
          {errors.date && <p className="text-xs mt-1" style={{ color: 'var(--state-noshow)' }}>{errors.date}</p>}
        </div>

        {/* Hora d'entrada */}
        <div style={{ marginBottom: 12 }}>
          <span className="label">{t('reserva.camps.hora')}</span>
          {slotsLoading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 8 }}>{t('common.carregant')}</p>
          ) : closed ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              {t('reserva.missatges.tancat')}
            </p>
          ) : (
            <TimeWheelPicker
              lunchSlots={lunchSlots}
              dinnerSlots={dinnerSlots}
              selected={time}
              onSelect={handleTimeSelect}
            />
          )}
          {errors.time && <p className="text-xs mt-1" style={{ color: 'var(--state-noshow)' }}>{errors.time}</p>}
        </div>

        {/* Hora de sortida */}
        {endTime && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', marginBottom: 20,
            background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8,
          }}>
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2,
              }}>
                {t('reserva.camps.horaSortida')}
              </p>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                {endTime}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ minWidth: 44, minHeight: 44 }}
                onClick={() => setDurationMinutes(d => Math.max(30, d - 15))}
              >
                −15
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ minWidth: 44, minHeight: 44 }}
                onClick={() => setDurationMinutes(d => Math.min(240, d + 15))}
              >
                +15
              </button>
            </div>
          </div>
        )}

        {/* Fila 2: Persones + Secció */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {/* Persones */}
          <div>
            <label className="label">{t('reserva.camps.persones')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-sm ${partySize === n && !showStepper ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, minHeight: 44 }}
                  onClick={() => { setPartySize(n); setShowStepper(false) }}
                >
                  {n}
                </button>
              ))}
              {showStepper ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, minHeight: 44 }}
                    onClick={() => setPartySize(p => Math.max(8, p - 1))}
                  >
                    −
                  </button>
                  <span style={{ flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                    {partySize}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, minHeight: 44 }}
                    onClick={() => setPartySize(p => p + 1)}
                  >
                    +
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={`btn btn-sm ${partySize > 7 ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, minHeight: 44 }}
                  onClick={() => { setPartySize(8); setShowStepper(true) }}
                >
                  +
                </button>
              )}
            </div>
          </div>

          {/* Secció */}
          {hasOutdoor && (
            <div>
              <label className="label">{t('reserva.camps.seccio')}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${section === 'indoor' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minHeight: 44 }}
                  onClick={() => setSection('indoor')}
                >
                  {t('reserva.seccions.interior')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${section === 'outdoor' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minHeight: 44 }}
                  onClick={() => setSection('outdoor')}
                >
                  {t('reserva.seccions.terrassa')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fila 3: Nom */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <span className="label">{t('reserva.camps.nom')}</span>
            <input
              type="text"
              className="input"
              placeholder={t('reserva.camps.nom')}
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ borderColor: errors.customer_name ? 'var(--state-noshow)' : undefined }}
            />
          </label>
          {errors.customer_name && <p className="text-xs mt-1" style={{ color: 'var(--state-noshow)' }}>{errors.customer_name}</p>}
        </div>

        {/* Fila 4: Telèfon */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <span className="label">
              {t('reserva.camps.telefon')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('reserva.camps.opcional')}</span>
            </span>
            <input
              type="tel"
              className="input"
              placeholder={t('reserva.camps.telefon')}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{ borderColor: errors.customer_phone ? 'var(--state-noshow)' : undefined }}
            />
          </label>
          {errors.customer_phone && <p className="text-xs mt-1" style={{ color: 'var(--state-noshow)' }}>{errors.customer_phone}</p>}
        </div>

        {/* Fila 5: Email (opcional) */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <span className="label">
              {t('reserva.camps.email')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('reserva.camps.opcional')}</span>
            </span>
            <input
              type="email"
              className="input"
              placeholder="correu@exemple.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>
        </div>

        {/* Fila 6: Número de taula (opcional) */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <span className="label">
              {t('reserva.camps.taula')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('reserva.camps.opcional')}</span>
            </span>
          {tables.length === 0 ? (
            <input
              type="text"
              className="input"
              placeholder="Ex: T-3, Barra, Terrassa 2"
              value={tableText}
              onChange={e => setTableText(e.target.value)}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(['indoor', 'outdoor'] as const).map(sec => {
                const group = tables.filter(t => t.section === sec)
                if (group.length === 0) return null
                return (
                  <div key={sec}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      {sec === 'indoor' ? t('reserva.seccions.interior') : t('reserva.seccions.terrassa')}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {group.map(table => {
                        const isOccupied = occupiedTableNumbers.has(table.number)
                        const isSelected = tableId === table.id
                        return (
                          <button
                            key={table.id}
                            type="button"
                            className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setTableId(id => id === table.id ? '' : table.id)}
                            style={{ opacity: isOccupied && !isSelected ? 0.4 : 1, position: 'relative' }}
                          >
                            {table.number}
                            <span style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>
                              {table.capacity}p
                            </span>
                            {isOccupied && !isSelected && (
                              <span style={{
                                position: 'absolute', top: -4, right: -4,
                                width: 8, height: 8, borderRadius: '50%',
                                background: 'var(--state-noshow)',
                                border: '1.5px solid white',
                              }} />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </label>

          {/* Capacity warning */}
          {(() => {
            const sel = tables.find(tb => tb.id === tableId)
            if (!sel || sel.capacity >= partySize) return null
            const fitting = tables.filter(tb => tb.capacity >= partySize)
            return (
              <div style={{ marginTop: 8, padding: '10px 12px', background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 8 }}>
                <p style={{ fontSize: 13, color: '#C2410C', marginBottom: fitting.length ? 6 : 0 }}>
                  {t('reserva.avisos.taulaCapPre')} {sel.capacity}p. {t('reserva.avisos.grupEsDe')} {partySize}p.
                </p>
                {fitting.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#9A3412' }}>{t('reserva.avisos.taulesHiCaben')}</span>
                    {fitting.map(tb => (
                      <button
                        key={tb.id}
                        type="button"
                        onClick={() => setTableId(tb.id)}
                        style={{
                          fontSize: 12, padding: '2px 10px', minHeight: 28, borderRadius: 6, cursor: 'pointer',
                          background: tableId === tb.id ? 'var(--primary)' : '#FFEDD5',
                          color: tableId === tb.id ? '#fff' : '#9A3412',
                          border: '1px solid #FED7AA',
                        }}
                      >
                        {tb.number} ({tb.capacity}p)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Fila 7: Notes (opcional) */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block' }}>
            <span className="label">
              {t('reserva.camps.notes')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('reserva.camps.opcional')}</span>
            </span>
            <textarea
              className="input"
              rows={3}
              placeholder="Al·lèrgies, preferències de taula..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          disabled={closed || pending}
        >
          {pending ? '...' : t('reserva.guardar')}
        </button>
      </form>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}
