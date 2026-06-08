'use client'
/* eslint-disable react-hooks/static-components */

import { useState } from 'react'
import type { Restaurant } from '@/db/schema'
import { getAvailableSlots } from '@/lib/schedule'

interface Props {
  restaurant: Restaurant
}

interface BookingData {
  date: string
  time: string
  party_size: number
  name: string
  phone: string
  allergies: string[]
  special_occasion: string
}

const ALLERGY_OPTIONS = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'lactosa', label: 'Lactosa' },
  { id: 'fruits_secs', label: 'Fruits secs' },
  { id: 'marisc', label: 'Marisc' },
  { id: 'ou', label: 'Ou' },
  { id: 'vegetaria', label: 'Vegetarià' },
  { id: 'vega', label: 'Vegà' },
]

export default function BookingWidget({ restaurant }: Props) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<BookingData>({
    date: '', time: '', party_size: 2,
    name: '', phone: '', allergies: [], special_occasion: '',
  })
  const [confirmed, setConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isLargeGroup = data.party_size >= restaurant.group_threshold

  function Step1() {
    const [localDate, setLocalDate] = useState(data.date)
    const [localTime, setLocalTime] = useState(data.time)
    const [localParty, setLocalParty] = useState(data.party_size)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const timeSlots = localDate ? getAvailableSlots(restaurant.weekly_hours, localDate) : []
    const today = new Date().toISOString().split('T')[0]

    function handleContinue() {
      const e: Record<string, string> = {}
      if (!localDate) e.date = 'Selecciona una data'
      if (!localTime) e.time = 'Selecciona una hora'
      if (Object.keys(e).length) { setErrors(e); return }
      setData(prev => ({ ...prev, date: localDate, time: localTime, party_size: localParty }))
      setStep(2)
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Quan vindreu?</h2>
          <p className="text-sm text-gray-500">Data, hora i nombre de persones</p>
        </div>

        <div>
          <label htmlFor="widget-date" className="block text-sm font-semibold text-gray-700 mb-2">Data</label>
          <input
            id="widget-date"
            type="date"
            min={today}
            value={localDate}
            onChange={e => { setLocalDate(e.target.value); setLocalTime('') }}
            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
        </div>

        {localDate && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Hora</label>
            {timeSlots.length === 0 ? (
              <p className="text-sm text-gray-500">No hi ha horaris disponibles per aquest dia</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map(slot => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setLocalTime(slot)}
                    className={`py-2 rounded-xl border text-sm font-medium transition-colors min-h-[44px]
                      ${localTime === slot
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'border-gray-200 text-gray-700 hover:border-amber-300'
                      }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
            {errors.time && <p className="mt-1 text-sm text-red-600">{errors.time}</p>}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Persones</label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setLocalParty(n)}
                className={`flex-1 min-w-[40px] py-2 rounded-xl border text-sm font-medium transition-colors min-h-[44px]
                  ${localParty === n
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-gray-200 text-gray-700 hover:border-amber-300'
                  }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLocalParty(restaurant.group_threshold)}
              className={`flex-1 min-w-[40px] py-2 rounded-xl border text-sm font-medium transition-colors min-h-[44px]
                ${localParty >= restaurant.group_threshold
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'border-gray-200 text-gray-700 hover:border-amber-300'
                }`}
            >
              {restaurant.group_threshold}+
            </button>
          </div>
          {isLargeGroup && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-800">
                Per a grups de {restaurant.group_threshold}+ persones us contactarem en menys de 2h per confirmar.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm min-h-[44px] hover:bg-amber-600 transition-colors"
        >
          Continuar
        </button>
      </div>
    )
  }

  function Step2() {
    const [localName, setLocalName] = useState(data.name)
    const [localPhone, setLocalPhone] = useState(data.phone)
    const [errors, setErrors] = useState<Record<string, string>>({})

    function handleContinue() {
      const e: Record<string, string> = {}
      if (!localName.trim()) e.name = 'El nom és obligatori'
      if (!localPhone.trim()) e.phone = 'El telèfon és obligatori'
      if (Object.keys(e).length) { setErrors(e); return }
      setData(prev => ({ ...prev, name: localName.trim(), phone: localPhone.trim() }))
      setStep(3)
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Les teves dades</h2>
          <p className="text-sm text-gray-500">Necessitem el nom i telèfon per confirmar</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="w-name" className="block text-sm font-semibold text-gray-700 mb-1">Nom complet</label>
            <input
              id="w-name"
              type="text"
              value={localName}
              onChange={e => { setLocalName(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
              placeholder="Ex: Maria García"
              autoComplete="name"
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="w-phone" className="block text-sm font-semibold text-gray-700 mb-1">Telèfon</label>
            <input
              id="w-phone"
              type="tel"
              value={localPhone}
              onChange={e => { setLocalPhone(e.target.value); setErrors(p => ({ ...p, phone: '' })) }}
              placeholder="Ex: 612 345 678"
              autoComplete="tel"
              inputMode="tel"
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm min-h-[44px] hover:bg-amber-600 transition-colors"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm min-h-[44px] hover:bg-gray-50 transition-colors"
          >
            Enrere
          </button>
        </div>
      </div>
    )
  }

  function Step3() {
    const [localAllergies, setLocalAllergies] = useState<string[]>([])
    const [localOccasion, setLocalOccasion] = useState('')

    function toggleAllergy(id: string) {
      setLocalAllergies(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
    }

    async function handleSubmit() {
      setIsSubmitting(true)
      setError('')
      try {
        const res = await fetch('/api/widget/reserva', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurant_id: restaurant.id,
            restaurant_name: restaurant.name,
            whatsapp_number: restaurant.whatsapp_number,
            date: data.date,
            time: data.time,
            party_size: data.party_size,
            customer_name: data.name,
            customer_phone: data.phone,
            allergies: localAllergies,
            special_occasion: localOccasion.trim() || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error desconegut')
        setData(prev => ({ ...prev, allergies: localAllergies, special_occasion: localOccasion }))
        setConfirmed(true)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error en crear la reserva')
      } finally {
        setIsSubmitting(false)
      }
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Alguna cosa més?</h2>
          <p className="text-sm text-gray-500">Opcional, però ens ajuda a preparar millor la teva visita</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Al·lèrgies o intoleràncies</label>
          <div className="grid grid-cols-2 gap-2">
            {ALLERGY_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleAllergy(opt.id)}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px] text-left
                  ${localAllergies.includes(opt.id)
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-gray-200 text-gray-700 hover:border-amber-300'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="w-occasion" className="block text-sm font-semibold text-gray-700 mb-1">
            Ocasió especial <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            id="w-occasion"
            type="text"
            value={localOccasion}
            onChange={e => setLocalOccasion(e.target.value)}
            placeholder="Ex: aniversari, petició de mà..."
            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm min-h-[44px] hover:bg-amber-600 transition-colors disabled:opacity-60"
          >
            {isSubmitting ? 'Confirmant...' : 'Confirmar reserva'}
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm min-h-[44px] hover:bg-gray-50 transition-colors"
          >
            Enrere
          </button>
        </div>
      </div>
    )
  }

  if (confirmed) {
    const formattedDate = data.date
      ? new Date(data.date + 'T12:00:00').toLocaleDateString('ca-ES', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
      : ''

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Reserva confirmada!</h2>
        <p className="text-sm text-gray-500 mb-6">Hem rebut la teva reserva correctament.</p>
        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 text-sm">
          <div><span className="text-gray-500">Restaurant:</span> <strong>{restaurant.name}</strong></div>
          <div><span className="text-gray-500">Data:</span> <strong>{formattedDate}</strong></div>
          <div><span className="text-gray-500">Hora:</span> <strong>{data.time}h</strong></div>
          <div><span className="text-gray-500">Persones:</span> <strong>{data.party_size}</strong></div>
          <div><span className="text-gray-500">Nom:</span> <strong>{data.name}</strong></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
      <div className="p-6">
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
      </div>
    </div>
  )
}
