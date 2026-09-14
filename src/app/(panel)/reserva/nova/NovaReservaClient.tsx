'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, UserRound, Armchair } from 'lucide-react'
import { Toast, useToast } from '@/components/ui/Toast'
import TimeWheelPicker from '@/components/TimeWheelPicker'
import DatePicker from '@/components/DatePicker'
import { createReservation, updateReservation, getAvailableSlotsForDate, getReservationsForDay, getCustomerHistory } from '@/app/actions/reservations'
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

function formatShortDate(iso: string): string {
  const MESOS = ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des']
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MESOS[m - 1]}`
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
  const [customerHistory, setCustomerHistory] = useState<{ visits: number; lastDate: string; recentNote: string | null } | null>(null)

  const hasOutdoor = restaurant.capacity_outdoor > 0

  async function handlePhoneBlur() {
    if (phone.trim().length < 6) { setCustomerHistory(null); return }
    const h = await getCustomerHistory(phone.trim())
    setCustomerHistory(h)
  }

  function handleDateChange(newDate: string) {
    setDate(newDate)
    setTime('')
    setSlotsLoading(true)
    startTransition(async () => {
      const [newSlots, dayRes] = await Promise.all([
        getAvailableSlotsForDate(newDate),
        getReservationsForDay(newDate),
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
        router.push(`/agenda?data=${data.date}`)
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
    <div className="reservation-page">
      {/* Capçalera */}
      <div className="reservation-header">
        <button
          onClick={() => { if (window.history.length > 1) router.back(); else router.push('/avui') }}
          className="btn btn-ghost reservation-back"
        >
          {t('reserva.tornar')}
        </button>
        <h1>
          {edit ? t('reserva.editar') : t('reserva.nova')}
        </h1>
        {initialTableId && !edit && (() => {
          const t2 = tables.find(t => t.id === initialTableId)
          return t2 ? (
            <span className="badge" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 600 }}>
              {t('reserva.taulaLabel')} {t2.number}
            </span>
          ) : null
        })()}
      </div>

      <form
        className="reservation-form"
        onSubmit={handleSubmit}
        style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? 'none' : 'auto' }}
      >
        <section className="reservation-section" aria-labelledby="reservation-when-title">
          <h2 id="reservation-when-title"><CalendarDays size={18} aria-hidden="true" />{t('reserva.grups.quan')}</h2>
        {/* Data */}
        <div className="reservation-field">
          <span className="label">{t('reserva.camps.data')}</span>
          <DatePicker
            value={date}
            onChange={handleDateChange}
            error={!!errors.date}
          />
          {errors.date && <p className="text-xs mt-1" style={{ color: 'var(--state-noshow)' }}>{errors.date}</p>}
        </div>

        {/* Hora d'entrada */}
        <div className="reservation-field">
          <span className="label">{t('reserva.camps.hora')}</span>
          {slotsLoading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 8 }}>{t('common.carregant')}</p>
          ) : closed ? (
            <p className="reservation-closed">
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

        {/* Durada estimada */}
        {endTime && (
          <div className="reservation-duration">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Durada estimada
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                fins a les <strong style={{ color: 'var(--text)' }}>{endTime}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ minWidth: 44, minHeight: 44 }}
                onClick={() => setDurationMinutes(d => Math.max(30, d - 15))}
              >
                −15 min
              </button>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                {durationMinutes} min
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ minWidth: 44, minHeight: 44 }}
                onClick={() => setDurationMinutes(d => Math.min(240, d + 15))}
              >
                +15 min
              </button>
            </div>
          </div>
        )}

        {/* Fila 2: Persones + Secció */}
        <div className="reservation-options">
          {/* Persones */}
          <div>
            <label className="label">{t('reserva.camps.persones')}</label>
            <div className="reservation-party-options">
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-sm ${partySize === n && !showStepper ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, minHeight: 44 }}
                  aria-pressed={partySize === n && !showStepper}
                  onClick={() => { setPartySize(n); setShowStepper(false) }}
                >
                  {n}
                </button>
              ))}
              {showStepper ? (
                <div className="reservation-party-stepper">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, minHeight: 44 }}
                    onClick={() => setPartySize(p => Math.max(8, p - 1))}
                  >
                    −
                  </button>
                  <span style={{
                    flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 16,
                    background: 'var(--primary)', color: 'white', borderRadius: 8,
                  }}>
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
                </div>
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
              <div className="reservation-section-options">
                <button
                  type="button"
                  className={`btn btn-sm ${section === 'indoor' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minHeight: 44 }}
                  aria-pressed={section === 'indoor'}
                  onClick={() => setSection('indoor')}
                >
                  {t('reserva.seccions.interior')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${section === 'outdoor' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minHeight: 44 }}
                  aria-pressed={section === 'outdoor'}
                  onClick={() => setSection('outdoor')}
                >
                  {t('reserva.seccions.terrassa')}
                </button>
              </div>
            </div>
          )}
        </div>

        </section>
        <section className="reservation-section" aria-labelledby="reservation-client-title">
          <h2 id="reservation-client-title"><UserRound size={18} aria-hidden="true" />{t('reserva.grups.client')}</h2>
        {/* Fila 3: Nom */}
        <div className="reservation-field">
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
        <div className="reservation-field">
          <label style={{ display: 'block' }}>
            <span className="label">{t('reserva.camps.telefon')}</span>
            <input
              type="tel"
              className="input"
              placeholder={t('reserva.camps.telefon')}
              value={phone}
              onChange={e => { setPhone(e.target.value); setCustomerHistory(null) }}
              onBlur={handlePhoneBlur}
              style={{ borderColor: errors.customer_phone ? 'var(--state-noshow)' : undefined }}
            />
          </label>
          {errors.customer_phone && <p className="text-xs mt-1" style={{ color: 'var(--state-noshow)' }}>{errors.customer_phone}</p>}
          {customerHistory && (
            <div style={{
              marginTop: 8, padding: '10px 12px',
              background: 'var(--primary-soft)', border: '1.5px solid var(--border)', borderRadius: 8,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: customerHistory.recentNote ? 4 : 0 }}>
                {customerHistory.visits === 1 ? '1a visita' : `${customerHistory.visits}a visita`}
                {' · '}
                <span style={{ fontWeight: 400 }}>última vegada el {formatShortDate(customerHistory.lastDate)}</span>
              </p>
              {customerHistory.recentNote && (
                <p style={{ fontSize: 13, color: 'var(--text)' }}>
                  Nota anterior: {customerHistory.recentNote}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Fila 5: Email (opcional) */}
        <div className="reservation-field">
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

        </section>
        <section className="reservation-section" aria-labelledby="reservation-details-title">
          <h2 id="reservation-details-title"><Armchair size={18} aria-hidden="true" />{t('reserva.grups.detalls')}</h2>
        {/* Fila 6: Número de taula (opcional) */}
        <div className="reservation-field">
          <div role="group" aria-labelledby="reservation-table-label">
            <label id="reservation-table-label" htmlFor={tables.length === 0 ? 'reservation-table-text' : undefined} className="label">
              {t('reserva.camps.taula')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('reserva.camps.opcional')}</span>
            </label>
          {tables.length === 0 ? (
            <input
              id="reservation-table-text"
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
                    <div className="reservation-table-options">
                      {group.map(table => {
                        const isOccupied = occupiedTableNumbers.has(table.number)
                        const isSelected = tableId === table.id
                        return (
                          <button
                            key={table.id}
                            type="button"
                            className={`btn reservation-table-option ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                            aria-pressed={isSelected}
                            onClick={() => setTableId(id => id === table.id ? '' : table.id)}
                            style={{ opacity: isOccupied && !isSelected ? 0.4 : 1, position: 'relative' }}
                          >
                            {table.number}
                            <span style={{ color: isSelected ? '#fff' : 'var(--text-muted)', fontSize: 12 }}>
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
          </div>

          {tables.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              <span style={{ color: 'var(--state-noshow)', marginRight: 4 }}>●</span>Ocupada
              <span style={{ marginLeft: 12, color: 'var(--state-arrived)', marginRight: 4 }}>●</span>Disponible
            </p>
          )}

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
        <div className="reservation-field">
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

        </section>
        {/* Submit */}
        <button
          type="submit"
          className="btn btn-primary btn-lg reservation-submit"
          disabled={pending || (!edit && closed)}
        >
          {pending ? 'Guardant...' : t('reserva.guardar')}
        </button>
      </form>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}
