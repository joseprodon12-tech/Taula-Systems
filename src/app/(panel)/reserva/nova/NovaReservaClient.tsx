'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, UserRound, Armchair } from 'lucide-react'
import { Toast, useToast } from '@/components/ui/Toast'
import TimeWheelPicker from '@/components/TimeWheelPicker'
import DatePicker from '@/components/DatePicker'
import { createReservation, updateReservation, getAvailableSlotsForDate, getReservationsForDay, getCustomerHistory } from '@/app/actions/reservations'
import { useT } from '@/context/LocaleContext'
import { returnView } from '@/lib/tornar'
import type { Restaurant, Reservation, Table } from '@/db/schema'

interface Props {
  initialDate: string
  initialSlots: string[]
  initialDayReservations: Reservation[]
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

export default function NovaReservaClient({ initialDate, initialSlots, initialDayReservations, initialTime, initialTableId, restaurant, editReservation, tables }: Props) {
  const router = useRouter()
  const { t } = useT()
  const { toast, show, hide } = useToast()
  const [pending, startTransition] = useTransition()

  const edit = editReservation
  const [date, setDate] = useState(edit?.date ?? initialDate)
  const [slots, setSlots] = useState<string[]>(initialSlots)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [time, setTime] = useState(edit?.time ?? initialTime)
  const [changingTime, setChangingTime] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState(() => {
    if (edit?.duration_minutes) return edit.duration_minutes
    const t = edit?.time ?? initialTime
    return t ? defaultDuration(restaurant, t) : restaurant.default_duration_lunch_min
  })
  const [partySize, setPartySize] = useState(edit?.party_size ?? 2)
  const [showStepper, setShowStepper] = useState((edit?.party_size ?? 2) > 6)
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
  // La zona surt de la taula: així no es pot desar Terrassa amb una taula de Sala
  const [section, setSection] = useState<'indoor' | 'outdoor'>(
    () => tables.find(t => t.id === tableId)?.section ?? edit?.section ?? 'indoor'
  )
  // Free-text table number when no tables are configured
  const [tableText, setTableText] = useState(tables.length === 0 ? (edit?.table_number ?? '') : '')
  const [dayReservations, setDayReservations] = useState<Reservation[]>(initialDayReservations)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customerHistory, setCustomerHistory] = useState<{ visits: number; lastDate: string; recentNote: string | null } | null>(null)

  const hasOutdoor = tables.some(t => t.section === 'outdoor')

  async function handlePhoneBlur() {
    if (phone.trim().length < 6) { setCustomerHistory(null); return }
    const h = await getCustomerHistory(phone.trim(), date)
    setCustomerHistory(h)
  }

  function clearTableError() {
    if (errors.table_number) setErrors(e => ({ ...e, table_number: '' }))
  }

  function handleDateChange(newDate: string) {
    setDate(newDate)
    setTime('')
    clearTableError()
    setSlotsLoading(true)
    startTransition(async () => {
      const [newSlots, dayRes] = await Promise.all([
        getAvailableSlotsForDate(newDate),
        getReservationsForDay(newDate),
      ])
      setSlots(newSlots)
      setDayReservations(dayRes)
      setSlotsLoading(false)
    })
  }

  function handleTimeSelect(selectedTime: string) {
    setTime(selectedTime)
    setDurationMinutes(defaultDuration(restaurant, selectedTime))
    clearTableError()
  }

  function changeDuration(delta: number) {
    setDurationMinutes(d => Math.min(240, Math.max(30, d + delta)))
    clearTableError()
  }

  function handleSectionChange(newSection: 'indoor' | 'outdoor') {
    setSection(newSection)
    if (tables.find(t => t.id === tableId)?.section !== newSection) setTableId('')
    clearTableError()
  }

  function handleTableSelect(table: Table) {
    clearTableError()
    if (tableId === table.id) { setTableId(''); return }
    setTableId(table.id)
    setSection(table.section)
  }

  const [savedWarning, setSavedWarning] = useState<{ text: string; back: string } | null>(null)
  const warningRef = useRef<HTMLDivElement>(null)
  // L'avís surt al final del formulari: si no el portem a la vista, queda sota la barra de navegació
  useEffect(() => {
    if (savedWarning) warningRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [savedWarning])

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

      if (edit) {
        const result = await updateReservation(edit.id, data)
        if ('error' in result) {
          setErrors(result.fieldErrors ?? {})
          show(result.error, 'error')
          return
        }
        router.push(`/reserva/${edit.id}`)
      } else {
        const result = await createReservation(data)
        if ('error' in result) {
          setErrors(result.fieldErrors ?? {})
          show(result.error, 'error')
          return
        }
        // Torna a la pantalla on es treballava (Avui, Gantt, Llista o Setmana), al dia de la reserva
        const back = returnView(data.date, `/agenda?data=${data.date}`)
        // L'avís el diu el servidor amb el seu text: ensenyar-lo aquí, abans de marxar
        if (result.warning) { setSavedWarning({ text: result.warning, back }); return }
        router.push(back)
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
          if (r.status !== 'pending' && r.status !== 'arrived' && r.status !== 'standby') return false
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
  // Una hora desada que ja no és a l'horari es conserva, però no s'ofereix com a franja disponible
  const keepsOldTime = !!edit && !changingTime && date === edit.date && time === edit.time && !slots.includes(edit.time)
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
          ) : keepsOldTime ? (
            <div className="reservation-closed" role="status" style={{ borderLeftColor: 'var(--warning)' }}>
              <p>
                <strong style={{ fontSize: 18, color: 'var(--text)' }}>{time}</strong>
                {' · '}{t('reserva.horaDesada.foraHorari')}
              </p>
              {slots.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8, minHeight: 44 }}
                  onClick={() => setChangingTime(true)}
                >
                  {t('reserva.horaDesada.triarAltra')}
                </button>
              )}
            </div>
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
                onClick={() => changeDuration(-15)}
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
                onClick={() => changeDuration(15)}
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
                  onClick={() => handleSectionChange('indoor')}
                >
                  {t('reserva.seccions.interior')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${section === 'outdoor' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minHeight: 44 }}
                  aria-pressed={section === 'outdoor'}
                  onClick={() => handleSectionChange('outdoor')}
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
                {`${customerHistory.visits + 1}a visita`}
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
              onChange={e => { setTableText(e.target.value); clearTableError() }}
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
                            onClick={() => handleTableSelect(table)}
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

          {errors.table_number && (
            <p role="alert" className="text-sm mt-2" style={{ color: 'var(--state-noshow)', fontWeight: 600 }}>
              {errors.table_number}
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
                        onClick={() => handleTableSelect(tb)}
                        style={{
                          fontSize: 12, padding: '2px 10px', minHeight: 28, borderRadius: 6, cursor: 'pointer',
                          background: tableId === tb.id ? 'var(--primary)' : '#FFEDD5',
                          color: tableId === tb.id ? '#fff' : '#9A3412',
                          border: '1px solid #FED7AA',
                        }}
                      >
                        {tb.number} · {tb.section === 'indoor' ? t('reserva.seccions.interior') : t('reserva.seccions.terrassa')} ({tb.capacity}p)
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
          disabled={pending || (closed && !keepsOldTime)}
        >
          {pending ? 'Guardant...' : t('reserva.guardar')}
        </button>

        {/* La reserva ja és desada: l'avís del servidor es llegeix abans de marxar */}
        {savedWarning && (
          <div
            ref={warningRef}
            role="status"
            style={{
              marginTop: 16, marginBottom: 24, padding: '14px 16px',
              borderLeft: '3px solid var(--warning)', borderRadius: '0 8px 8px 0',
              background: 'var(--warning-bg)', color: 'var(--text)',
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{t('reserva.desadaAmbAvis')}</p>
            <p style={{ fontSize: 14, marginBottom: 12 }}>{savedWarning.text}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.push(savedWarning.back)}
            >
              {t('reserva.continuar')}
            </button>
          </div>
        )}
      </form>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}
