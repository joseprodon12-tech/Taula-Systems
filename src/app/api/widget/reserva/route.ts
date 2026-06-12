import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAvailableSlots } from '@/lib/schedule'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      restaurant_id,
      date, time, party_size, customer_name, customer_phone,
      allergies, special_occasion,
    } = body

    if (!restaurant_id || !date || !time || !party_size || !customer_name || !customer_phone) {
      return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
    }

    const pax = Number(party_size)
    if (!Number.isInteger(pax) || pax < 1 || pax > 50) {
      return NextResponse.json({ error: 'Nombre de persones no vàlid' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Always read restaurant config from DB — never trust client-supplied name/whatsapp
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurant_id)
      .single()

    if (restError || !restaurant) {
      return NextResponse.json({ error: 'Restaurant no trobat' }, { status: 404 })
    }

    // Validate slot against weekly_hours
    const availableSlots = getAvailableSlots(restaurant.weekly_hours, date)
    if (!availableSlots.includes(time)) {
      return NextResponse.json({ error: 'Hora no disponible' }, { status: 400 })
    }

    // Validate closure
    const { data: closure } = await supabase
      .from('closures')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .eq('date', date)
      .maybeSingle()

    if (closure) {
      return NextResponse.json({ error: 'El restaurant és tancat aquest dia' }, { status: 400 })
    }

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

    const hour = parseInt(time.split(':')[0])
    const isLunch = hour >= 12 && hour < 17
    const duration = isLunch
      ? (restaurant.default_duration_lunch_min ?? 90)
      : (restaurant.default_duration_dinner_min ?? 90)

    const [rh, rm] = time.split(':').map(Number)
    const rStart = rh * 60 + rm
    const rEnd = rStart + duration

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
      t => t.capacity >= pax && !occupiedNumbers.has(t.number)
    )

    const assignedStatus = assignedTable ? 'pending' : 'standby'
    const assignedTableNumber = assignedTable ? assignedTable.number : null

    const { data, error } = await supabase.from('reservations').insert({
      restaurant_id,
      date,
      time,
      party_size: pax,
      section: assignedTable?.section ?? 'indoor',
      duration_minutes: duration,
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

      if (accountSid && authToken && from && restaurant.whatsapp_number) {
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
          body: `🍽️ *${restaurant.name}*\n\nHola ${customer_name}! La teva reserva ha estat rebuda.\n\n📅 ${formattedDate}\n🕐 ${time}h\n👥 ${pax} ${pax === 1 ? 'persona' : 'persones'}\n\nEn 24 hores rebràs un recordatori. Si necessites canviar, respon a aquest missatge.`,
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
