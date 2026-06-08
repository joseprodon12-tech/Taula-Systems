'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Toast, useToast } from '@/components/ui/Toast'
import { updateReservationStatus, cancelReservation } from '@/app/actions/reservations'
import { useT } from '@/context/LocaleContext'
import type { Reservation, Table } from '@/db/schema'

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-pending',
  arrived: 'badge-arrived',
  no_show: 'badge-noshow',
  cancelled: 'badge-cancel',
}

function formatShortDate(iso: string): string {
  const MESOS = ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des']
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MESOS[m - 1]}`
}

function formatDate(iso: string, il: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekday = new Intl.DateTimeFormat(il, { weekday: 'long' }).format(date)
  const month   = new Intl.DateTimeFormat(il, { month: 'long' }).format(date)
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${d} de ${month}`
}

interface Props {
  reservation: Reservation
  tables: Table[]
  customerHistory: { visits: number; lastDate: string; recentNote: string | null } | null
}

export default function ReservaDetallClient({ reservation, tables, customerHistory }: Props) {
  const router = useRouter()
  const { t, locale } = useT()
  const { toast, hide } = useToast()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState(reservation.status)
  const [showCancelSheet, setShowCancelSheet] = useState(false)

  function handleStatusChange(newStatus: 'pending' | 'arrived' | 'no_show') {
    setStatus(newStatus)
    startTransition(async () => {
      await updateReservationStatus(reservation.id, newStatus)
    })
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelReservation(reservation.id)
      router.push('/avui')
    })
  }

  const sectionLabel = reservation.section === 'indoor'
    ? t('reserva.seccions.interior')
    : t('reserva.seccions.terrassa')

  function addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number)
    const total = h * 60 + m + minutes
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const endTime = addMinutes(reservation.time, reservation.duration_minutes)

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Capçalera */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => { if (window.history.length > 1) router.back(); else router.push('/avui') }}
          className="btn btn-ghost btn-sm"
          style={{ padding: '6px 8px' }}
        >
          <ChevronLeft size={16} />
          {t('reserva.tornar')}
        </button>
        <div className="flex items-center gap-3">
          <span className={`badge ${STATUS_BADGE[status]}`}>{t(`reserva.estats.${status}` as Parameters<typeof t>[0])}</span>
          {status !== 'cancelled' && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push(`/reserva/nova?editar=${reservation.id}`)}
            >
              {t('reserva.accions.editar')}
            </button>
          )}
        </div>
      </div>

      {/* Hero: hora i pax */}
      <div className="card mb-4" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {reservation.time}
            <span style={{ color: 'var(--text-muted)', fontSize: 20, fontWeight: 400, margin: '0 8px' }}>→</span>
            {endTime}
          </div>
          <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{reservation.customer_name}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', marginTop: 6 }}>
          ×{reservation.party_size} {t('reserva.camps.persones').toLowerCase()}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {sectionLabel}</span>
          {reservation.table_number
            ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {t('reserva.camps.taula')} {reservation.table_number}</span>
            : <span style={{ color: '#B45309', fontWeight: 400, fontSize: 14 }}> · <span style={{ fontSize: 24 }}>⚠</span> Sense taula assignada</span>
          }
        </div>
      </div>

      {/* Capacity warning */}
      {(() => {
        if (!reservation.table_number) return null
        const tbl = tables.find(tb => tb.number === reservation.table_number && tb.section === reservation.section)
                 ?? tables.find(tb => tb.number === reservation.table_number)
        if (!tbl || tbl.capacity >= reservation.party_size) return null
        const fitting = tables.filter(tb => tb.capacity >= reservation.party_size)
        return (
          <div style={{ marginBottom: 16, padding: '10px 12px', background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 8 }}>
            <p style={{ fontSize: 13, color: '#C2410C', marginBottom: fitting.length ? 6 : 0 }}>
              {t('reserva.avisos.taulaCapPre')} {tbl.capacity}p. {t('reserva.avisos.grupEsDe')} {reservation.party_size}p.
            </p>
            {fitting.length > 0 && (
              <p style={{ fontSize: 12, color: '#9A3412' }}>
                {t('reserva.avisos.taulesHiCaben')} {fitting.map(tb => `${tb.number} (${tb.capacity}p)`).join(', ')}
              </p>
            )}
          </div>
        )
      })()}

      {/* Dades del client */}
      <div className="card mb-4">
        <Row
          label={t('reserva.camps.telefon')}
          value={
            <a href={`tel:${reservation.customer_phone}`} style={{ color: 'var(--primary)' }}>
              {reservation.customer_phone}
            </a>
          }
        />
        <div className="divider" />
        <Row label={t('reserva.camps.email')} value={reservation.customer_email || '—'} />
        {customerHistory && customerHistory.visits > 1 && (
          <>
            <div className="divider" />
            <div style={{ padding: '4px 0' }}>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                background: '#EEF2FF', color: 'var(--primary)', fontSize: 12, fontWeight: 600,
              }}>
                {customerHistory.visits}a visita · última el {formatShortDate(customerHistory.lastDate)}
              </span>
              {customerHistory.recentNote && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Nota anterior: {customerHistory.recentNote}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detalls de la reserva */}
      <div className="card mb-4">
        <Row label={t('reserva.camps.data')} value={formatDate(reservation.date, locale === 'ca' ? 'ca' : 'es')} />
        <div className="divider" />
        <Row label={t('reserva.camps.seccio')} value={sectionLabel} />
        {reservation.notes && (
          <>
            <div className="divider" />
            <Row label={t('reserva.camps.notes')} value={reservation.notes} />
          </>
        )}
      </div>

      {/* Canviar estat */}
      {status !== 'cancelled' && (
        <div className="card mb-4">
          <p className="section-title mb-3">{t('reserva.accions.canviarEstat')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['pending', 'arrived', 'no_show'] as const).map(s => (
              <button
                key={s}
                className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleStatusChange(s)}
                disabled={pending}
                style={{ minHeight: 44, flex: 1 }}
              >
                {t(`reserva.estats.${s}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cancel·lar */}
      {status !== 'cancelled' && (
        <button
          className="btn btn-danger"
          style={{ width: '100%' }}
          onClick={() => setShowCancelSheet(true)}
        >
          {t('reserva.cancellar')}
        </button>
      )}

      {/* Bottom sheet de confirmació */}
      {showCancelSheet && (
        <>
          <div
            onClick={() => setShowCancelSheet(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40,
            }}
          />
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
              background: 'var(--bg)', borderRadius: '16px 16px 0 0',
              padding: '24px 20px 32px',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
            }}
          >
            <p className="font-bold mb-2" style={{ color: 'var(--text)', fontSize: 17 }}>
              {t('reserva.confirmCancellar.titol')}
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              {t('reserva.confirmCancellar.missatge')} {reservation.customer_name}?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setShowCancelSheet(false)}
              >
                {t('reserva.confirmCancellar.mantenir')}
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={handleCancel}
                disabled={pending}
              >
                {t('reserva.confirmCancellar.confirmar')}
              </button>
            </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '4px 0' }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
