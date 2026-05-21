'use client'

import { useTransition } from 'react'
import { Phone, FileText, Users, CheckCircle, XCircle, Clock } from 'lucide-react'
import { updateReservationStatus } from '@/app/actions/reservations'
import { useT } from '@/context/LocaleContext'
import type { Reservation } from '@/db/schema'
import Link from 'next/link'

const STATUS_CSS: Record<string, string> = {
  pending:   'badge-pending',
  arrived:   'badge-arrived',
  no_show:   'badge-noshow',
  cancelled: 'badge-cancel',
}

interface Props {
  reservation: Reservation
}

export default function ReservationCard({ reservation: r }: Props) {
  const [isPending, startTransition] = useTransition()
  const { t } = useT()

  function setStatus(status: 'arrived' | 'no_show' | 'pending') {
    startTransition(() => updateReservationStatus(r.id, status))
  }

  const isActionable = r.status === 'pending' || r.status === 'arrived' || r.status === 'no_show'

  return (
    <Link
      href={`/reserva/${r.id}`}
      className="block card hover:shadow-sm transition-shadow"
      style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 0.15s' }}
      onClick={e => {
        const target = e.target as HTMLElement
        if (target.closest('button')) e.preventDefault()
      }}
    >
      {/* Top row: hora + pax + badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text)' }}>
            {r.time}
          </span>
          <div className="flex items-center gap-1" style={{ color: 'var(--primary)' }}>
            <Users size={14} />
            <span className="text-base font-bold">{r.party_size}p</span>
          </div>
        </div>
        <span className={`badge ${STATUS_CSS[r.status]} shrink-0`}>
          {t(`reserva.estats.${r.status}` as Parameters<typeof t>[0])}
        </span>
      </div>

      {/* Nom */}
      <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>{r.customer_name}</p>

      {/* Telèfon */}
      <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
        <Phone size={11} />
        <span>{r.customer_phone}</span>
        {r.section === 'outdoor' && (
          <span
            className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium"
            style={{ background: '#F0FDF4', color: '#166534', fontSize: '11px' }}
          >
            {t('reserva.seccions.terrassa')}
          </span>
        )}
      </div>

      {/* Notes */}
      {r.notes && (
        <div className="flex items-start gap-1 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          <FileText size={11} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{r.notes}</span>
        </div>
      )}

      {/* Action buttons */}
      {isActionable && r.status !== 'cancelled' && (
        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          {r.status !== 'arrived' && (
            <button
              className="btn btn-sm flex-1"
              disabled={isPending}
              onClick={() => setStatus('arrived')}
              style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #6EE7B7', minHeight: 44 }}
            >
              <CheckCircle size={13} />
              {t('reserva.estats.arrived')}
            </button>
          )}
          {r.status === 'arrived' && (
            <button
              className="btn btn-sm flex-1"
              disabled={isPending}
              onClick={() => setStatus('pending')}
              style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', minHeight: 44 }}
            >
              <Clock size={13} />
              {t('reserva.accions.marcarPendent')}
            </button>
          )}
          {r.status !== 'no_show' && (
            <button
              className="btn btn-sm flex-1"
              disabled={isPending}
              onClick={() => setStatus('no_show')}
              style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', minHeight: 44 }}
            >
              <XCircle size={13} />
              {t('reserva.estats.no_show')}
            </button>
          )}
          {r.status === 'no_show' && (
            <button
              className="btn btn-sm flex-1"
              disabled={isPending}
              onClick={() => setStatus('pending')}
              style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', minHeight: 44 }}
            >
              <Clock size={13} />
              {t('reserva.accions.marcarPendent')}
            </button>
          )}
        </div>
      )}
    </Link>
  )
}
