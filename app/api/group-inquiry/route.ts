import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { restaurant_id, restaurant_name, preferred_date, name, phone } = body

    if (!restaurant_id || !name || !phone) {
      return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
    }

    // Guardar com a reserva pendent amb party_size gran
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        restaurant_id,
        date: preferred_date || new Date().toISOString().split('T')[0],
        time: '13:00',
        party_size: 8,
        name,
        phone,
        allergies: [],
        special_occasion: 'Consulta grup gran',
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Error en enviar la consulta' }, { status: 500 })
    }

    // Notificar al client per WhatsApp
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_WHATSAPP_FROM

      if (accountSid && authToken && from) {
        const client = twilio(accountSid, authToken)

        const message = `🍽️ *${restaurant_name}*\n\nHola ${name}! Hem rebut la teva sol·licitud per a un grup gran.\n\nEns posarem en contacte amb tu en menys de 2 hores per confirmar disponibilitat i condicions.\n\nGràcies!`

        const toNumber = phone.startsWith('+') ? phone : `+34${phone.replace(/\s/g, '')}`

        await client.messages.create({
          from,
          to: `whatsapp:${toNumber}`,
          body: message,
        })
      }
    } catch (twilioError) {
      console.error('Twilio error:', twilioError)
    }

    return NextResponse.json({ inquiry: data }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
