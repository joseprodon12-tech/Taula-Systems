'use client'

import { useState } from 'react'

interface Props {
  onComplete: (allergies: string[], special_occasion: string) => void
  onBack: () => void
  isSubmitting: boolean
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

export default function Step3Extras({ onComplete, onBack, isSubmitting }: Props) {
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([])
  const [specialOccasion, setSpecialOccasion] = useState('')

  function toggleAllergy(id: string) {
    setSelectedAllergies(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  function handleSubmit() {
    onComplete(selectedAllergies, specialOccasion.trim())
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Alguna cosa més?</h2>
        <p className="text-sm text-gray-500">Opcional, però ens ajuda a preparar millor la teva visita</p>
      </div>

      {/* Al·lèrgies */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Al·lèrgies o intoleràncies
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ALLERGY_OPTIONS.map(option => {
            const isSelected = selectedAllergies.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleAllergy(option.id)}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px] text-left
                  ${isSelected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
              >
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                  ${isSelected ? 'border-white bg-white' : 'border-gray-400'}`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Ocasió especial */}
      <div>
        <label htmlFor="occasion" className="block text-sm font-semibold text-gray-700 mb-2">
          Ocasió especial <span className="font-normal text-gray-400">(opcional)</span>
        </label>
        <input
          id="occasion"
          type="text"
          value={specialOccasion}
          onChange={e => setSpecialOccasion(e.target.value)}
          placeholder="Ex: aniversari, petició de mà..."
          className="input-field"
        />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? 'Confirmant reserva...' : 'Confirmar reserva'}
        </button>
        <button type="button" onClick={onBack} disabled={isSubmitting} className="btn-secondary">
          Enrere
        </button>
      </div>
    </div>
  )
}
