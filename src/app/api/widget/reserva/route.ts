import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      restaurant_id, restaurant_name, whatsapp_number,
      date, time, party_size, customer_name, customer_phone,
      allergies, special_occasion,
    } = body

    if (!restaurant_id || !date || !time || !party_size || !customer_name || !customer_phone) {
      return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: allTables } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .order('capacity', { ascending: true })

    const { data: existingRes } = await supabase
      .from('reservations')
      .select('table_number, time, duration_minutes')
      .eq('restaurant_id', restaurant_id)
      .eq('date', date)
      .in('status', ['pending', 'arrived', 'standby'])
      .not('table_number', 'is', null)

    const [rh, rm] = time.split(':').map(Number)
    const rStart = rh * 60 + rm
    const rEnd = rStart + 90

    const occupiedNumbers = new Set(
      (existingRes || [])
        .filter(r => {
          const [oh, om] = r.time.split(':').map(Number)
          const oStart = oh * 60 + om
          const oEnd = oStart + (r.duration_minutes || 90)
          return rStart < oEnd && rEnd > oStart
        })
        .map(r => r.table_number)
    )

    const assignedTable = (allTables || []).find(
      t => t.capacity >= Number(party_size) && !occupiedNumbers.has(t.number)
    )

    const assignedStatus = assignedTable ? 'pending' : 'standby'
    const assignedTableNumber = assignedTable ? assignedTable.number : null

    const { data, error } = await supabase.from('reservations').insert({
      restaurant_id,
      date,
      time,
      party_size: Number(party_size),
      section: assignedTable?.section ?? 'indoor',
      duration_minutes: 90,
      customer_name,
      customer_phone,
      allergies: allergies || [],
      special_occasion: special_occasion || null,
      status: assignedStatus,
      source: 'widget',
      table_number: assignedTableNumber,
    }).select('id').single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Error en guardar la reserva' }, { status: 500 })
    }

    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_WHATSAPP_FROM

      if (accountSid && authToken && from && whatsapp_number) {
        const twilio = (await import('twilio')).default
        const client = twilio(accountSid, authToken)

        const dateObj = new Date(date + 'T12:00:00')
        const formattedDate = dateObj.toLocaleDateString('ca-ES', {
          weekday: 'long', day: 'numeric', month: 'long',
        })

        const toNumber = customer_phone.startsWith('+')
          ? customer_phone
          : `+34${customer_phone.replace(/\s/g, '')}`

        await client.messages.create({
          from,
          to: `whatsapp:${toNumber}`,
          body: `🍽️ *${restaurant_name}*\n\nHola ${customer_name}! La teva reserva ha estat rebuda.\n\n📅 ${formattedDate}\n🕐 ${time}h\n👥 ${party_size} ${Number(party_size) === 1 ? 'persona' : 'persones'}\n\nEn 24 hores rebràs un recordatori. Si necessites canviar, respon a aquest missatge.`,
        })
      }
    } catch (twilioError) {
      console.error('Twilio error:', twilioError)
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
