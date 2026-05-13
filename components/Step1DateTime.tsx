'use client'

import { useState } from 'react'
import { Restaurant } from '@/lib/supabase'
import { getTimeSlotsForDate } from '@/lib/schedule'
import CalendarPicker from './CalendarPicker'

interface Props {
  restaurant: Restaurant
  initialDate: string
  initialTime: string
  initialPartySize: number
  onComplete: (date: string, time: string, party_size: number) => void
}

const PARTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

export default function Step1DateTime({ restaurant, initialDate, initialTime, initialPartySize, onComplete }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    initialDate ? new Date(initialDate + 'T12:00:00') : null
  )
  const [selectedTime, setSelectedTime] = useState(initialTime)
  const [partySize, setPartySize] = useState(initialPartySize)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const timeSlots = selectedDate ? getTimeSlotsForDate(restaurant.schedule, selectedDate) : []

  function handleDateSelect(date: Date) {
    setSelectedDate(date)
    setSelectedTime('')
    setErrors(prev => ({ ...prev, date: '', time: '' }))
  }

  function handleTimeSelect(time: string) {
    setSelectedTime(time)
    setErrors(prev => ({ ...prev, time: '' }))
  }

  function handlePartySelect(size: number) {
    setPartySize(size)
    setErrors(prev => ({ ...prev, party: '' }))
  }

  function handleContinue() {
    const newErrors: Record<string, string> = {}
    if (!selectedDate) newErrors.date = 'Selecciona una data'
    if (!selectedTime) newErrors.time = 'Selecciona una hora'
    if (!partySize) newErrors.party = 'Selecciona el nombre de persones'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const dateStr = selectedDate!.toISOString().split('T')[0]
    onComplete(dateStr, selectedTime, partySize)
  }

  const isLargeGroup = partySize >= restaurant.group_threshold

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Quan vindreu?</h2>
        <p className="text-sm text-gray-500">Selecciona data, hora i nombre de persones</p>
      </div>

      {/* Selector de data */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Data</label>
        <CalendarPicker
          schedule={restaurant.schedule}
          selectedDate={selectedDate}
          onSelect={handleDateSelect}
        />
        {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
      </div>

      {/* Selector d'hora */}
      {selectedDate && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Hora</label>
          {timeSlots.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No hi ha torns disponibles per aquest dia</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {timeSlots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleTimeSelect(slot)}
                  className={`btn-option text-sm ${selectedTime === slot ? 'btn-option-selected' : ''}`}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
          {errors.time && <p className="mt-1 text-sm text-red-600">{errors.time}</p>}
        </div>
      )}

      {/* Selector de persones */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Persones</label>
        <div className="grid grid-cols-4 gap-2">
          {PARTY_OPTIONS.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => handlePartySelect(n)}
              className={`btn-option ${partySize === n ? 'btn-option-selected' : ''}`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handlePartySelect(restaurant.group_threshold)}
            className={`btn-option ${partySize >= restaurant.group_threshold ? 'btn-option-selected' : ''}`}
          >
            {restaurant.group_threshold}+
          </button>
        </div>
        {errors.party && <p className="mt-1 text-sm text-red-600">{errors.party}</p>}

        {isLargeGroup && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-800">
              Per a grups de {restaurant.group_threshold} o més persones, gestionem la reserva de forma especial. Et contactarem en menys de 2 hores.
            </p>
          </div>
        )}
      </div>

      <button type="button" onClick={handleContinue} className="btn-primary">
        Continuar
      </button>
    </div>
  )
}
