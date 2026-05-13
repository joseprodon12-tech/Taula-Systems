'use client'

import { useState } from 'react'

interface Props {
  initialName: string
  initialPhone: string
  onComplete: (name: string, phone: string) => void
  onBack: () => void
}

export default function Step2Contact({ initialName, initialPhone, onComplete, onBack }: Props) {
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

  function handleContinue() {
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    onComplete(name.trim(), phone.trim())
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Les teves dades</h2>
        <p className="text-sm text-gray-500">Necessitem el teu nom i telèfon per confirmar la reserva</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
            Nom complet
          </label>
          <input
            id="name"
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
          <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
            Telèfon
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={e => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: '' })) }}
            placeholder="Ex: 612 345 678"
            autoComplete="tel"
            inputMode="tel"
            className="input-field"
          />
          {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
          <p className="mt-2 text-xs text-gray-400">
            Només t&apos;avisarem si hi ha algun problema amb la teva reserva
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={handleContinue} className="btn-primary">
          Continuar
        </button>
        <button type="button" onClick={onBack} className="btn-secondary">
          Enrere
        </button>
      </div>
    </div>
  )
}
