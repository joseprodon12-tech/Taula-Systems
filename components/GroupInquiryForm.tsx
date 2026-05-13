'use client'

import { useState } from 'react'

interface Props {
  initialName: string
  initialPhone: string
  preferredDate: string
  groupThreshold: number
  isSubmitting: boolean
  onSubmit: (name: string, phone: string) => void
  onBack: () => void
}

export default function GroupInquiryForm({
  initialName,
  initialPhone,
  preferredDate,
  groupThreshold,
  isSubmitting,
  onSubmit,
  onBack,
}: Props) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'El nom és obligatori'
    if (!phone.trim()) {
      newErrors.phone = 'El telèfon és obligatori'
    } else if (!/^[\d\s+()-]{9,}$/.test(phone.trim())) {
      newErrors.phone = 'Introdueix un telèfon vàlid'
    }
    return newErrors
  }

  function handleSubmit() {
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    onSubmit(name.trim(), phone.trim())
  }

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-sm font-semibold text-blue-900 mb-1">Reserva per a grups grans</p>
        <p className="text-sm text-blue-700">
          Per a grups de {groupThreshold} o més persones, la reserva es gestiona de forma especial.
          Et contactarem en menys de 2 hores per confirmar disponibilitat i condicions.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="group-name" className="block text-sm font-semibold text-gray-700 mb-2">
            Nom de contacte
          </label>
          <input
            id="group-name"
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })) }}
            placeholder="Ex: Maria García"
            autoComplete="name"
            className="input-field"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="group-phone" className="block text-sm font-semibold text-gray-700 mb-2">
            Telèfon
          </label>
          <input
            id="group-phone"
            type="tel"
            value={phone}
            onChange={e => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: '' })) }}
            placeholder="Ex: 612 345 678"
            autoComplete="tel"
            inputMode="tel"
            className="input-field"
          />
          {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
        </div>

        {preferredDate && (
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Data preferida</p>
            <p className="text-sm font-medium text-gray-800">
              {new Date(preferredDate + 'T12:00:00').toLocaleDateString('ca-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? 'Enviant...' : 'Enviar sol·licitud'}
        </button>
        <button type="button" onClick={onBack} disabled={isSubmitting} className="btn-secondary">
          Enrere
        </button>
      </div>
    </div>
  )
}
