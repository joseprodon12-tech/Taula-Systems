'use client'

import { useState } from 'react'
import { Restaurant } from '@/lib/supabase'
import ProgressBar from './ProgressBar'
import Step1DateTime from './Step1DateTime'
import Step2Contact from './Step2Contact'
import Step3Extras from './Step3Extras'
import GroupInquiryForm from './GroupInquiryForm'
import ConfirmationScreen from './ConfirmationScreen'

interface Props {
  restaurant: Restaurant
}

export interface BookingData {
  date: string
  time: string
  party_size: number
  name: string
  phone: string
  allergies: string[]
  special_occasion: string
}

const INITIAL_DATA: BookingData = {
  date: '',
  time: '',
  party_size: 2,
  name: '',
  phone: '',
  allergies: [],
  special_occasion: '',
}

export default function BookingForm({ restaurant }: Props) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<BookingData>(INITIAL_DATA)
  const [isGroupFlow, setIsGroupFlow] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [reservationId, setReservationId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateData(updates: Partial<BookingData>) {
    setData(prev => ({ ...prev, ...updates }))
  }

  function handleStep1Complete(date: string, time: string, party_size: number) {
    updateData({ date, time, party_size })
    if (party_size >= restaurant.group_threshold) {
      setIsGroupFlow(true)
    }
    setStep(2)
  }

  function handleStep2Complete(name: string, phone: string) {
    updateData({ name, phone })
    if (isGroupFlow) {
      handleGroupSubmit(name, phone)
    } else {
      setStep(3)
    }
  }

  async function handleGroupSubmit(name: string, phone: string) {
    setIsSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/group-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
          preferred_date: data.date,
          name,
          phone,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error desconegut')
      setReservationId(json.inquiry?.id || '')
      setConfirmed(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error en enviar la consulta')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleFinalSubmit(allergies: string[], special_occasion: string) {
    setIsSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
          date: data.date,
          time: data.time,
          party_size: data.party_size,
          name: data.name,
          phone: data.phone,
          allergies,
          special_occasion,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error desconegut')
      setReservationId(json.reservation?.id || '')
      updateData({ allergies, special_occasion })
      setConfirmed(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error en crear la reserva')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (confirmed) {
    return (
      <ConfirmationScreen
        data={data}
        restaurantName={restaurant.name}
        isGroup={isGroupFlow}
        reservationId={reservationId}
      />
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {!isGroupFlow && <ProgressBar step={step} totalSteps={3} />}

      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 1 && !isGroupFlow && (
          <Step1DateTime
            restaurant={restaurant}
            initialDate={data.date}
            initialTime={data.time}
            initialPartySize={data.party_size}
            onComplete={handleStep1Complete}
          />
        )}

        {step === 2 && !isGroupFlow && (
          <Step2Contact
            initialName={data.name}
            initialPhone={data.phone}
            onComplete={handleStep2Complete}
            onBack={() => setStep(1)}
          />
        )}

        {step === 2 && isGroupFlow && (
          <GroupInquiryForm
            initialName={data.name}
            initialPhone={data.phone}
            preferredDate={data.date}
            groupThreshold={restaurant.group_threshold}
            isSubmitting={isSubmitting}
            onSubmit={handleStep2Complete}
            onBack={() => { setIsGroupFlow(false); setStep(1) }}
          />
        )}

        {step === 3 && !isGroupFlow && (
          <Step3Extras
            onComplete={handleFinalSubmit}
            onBack={() => setStep(2)}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  )
}
