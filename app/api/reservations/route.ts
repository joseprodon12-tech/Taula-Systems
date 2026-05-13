import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, NewReservation } from '@/lib/supabase'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { restaurant_id, restaurant_name, date, time, party_size, name, phone, allergies, special_occasion } = body

    if (!restaurant_id || !date || !time || !party_size || !name || !phone) {
      return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
    }

    const reservation: NewReservation = {
      restaurant_id,
      date,
      time,
      party_size: Number(party_size),
      name,
      phone,
      allergies: allergies || [],
      special_occasion: special_occasion || null,
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('reservations')
      .insert(reservation)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Error en guardar la reserva' }, { status: 500 })
    }

    // Enviar WhatsApp via Twilio Sandbox
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_WHATSAPP_FROM

      if (accountSid && authToken && from) {
        const client = twilio(accountSid, authToken)

        const dateObj = new Date(date + 'T12:00:00')
        const formattedDate = dateObj.toLocaleDateString('ca-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })

        const message = `🍽️ *${restaurant_name}*\n\nHola ${name}! La teva reserva ha estat rebuda.\n\n📅 ${formattedDate}\n🕐 ${time}h\n👥 ${party_size} ${party_size === 1 ? 'persona' : 'persones'}\n\nEn 24 hores rebràs un recordatori de confirmació. Si necessites canviar o cancel·lar, respon a aquest missatge.`

        const toNumber = phone.startsWith('+') ? phone : `+34${phone.replace(/\s/g, '')}`

        await client.messages.create({
          from,
          to: `whatsapp:${toNumber}`,
          body: message,
        })
      }
    } catch (twilioError) {
      // No bloquejem la reserva si falla el WhatsApp
      console.error('Twilio error:', twilioError)
    }

    return NextResponse.json({ reservation: data }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
