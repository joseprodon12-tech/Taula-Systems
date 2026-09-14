import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendReservationNotification } from '@/lib/notifications'
import type { Reservation, Restaurant } from '@/db/schema'

// Vercel Cron crida aquesta ruta un cop al dia (vegeu vercel.json).
// Envia el recordatori a les reserves de DEMÀ que encara no l'han rebut.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Data (YYYY-MM-DD) a la zona del restaurant, amb N dies de desplaçament. */
function localDate(offsetDays: number): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offsetDays)
  // en-CA dona directament el format YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron recordatoris: CRON_SECRET no configurada')
    return NextResponse.json({ error: 'No configurat' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const target = localDate(1)

    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('date', target)
      .in('status', ['pending', 'arrived'])
      .is('reminder_sent_at', null)

    if (error) {
      console.error('cron recordatoris: error llegint reserves', error)
      return NextResponse.json({ error: 'Error de lectura' }, { status: 500 })
    }

    if (!reservations?.length) {
      return NextResponse.json({ date: target, sent: 0, skipped: 0, failed: 0 })
    }

    // Una sola lectura de restaurants per a tot el lot
    const ids = [...new Set(reservations.map(r => r.restaurant_id))]
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('*')
      .in('id', ids)

    const byId = new Map<string, Restaurant>(
      (restaurants ?? []).map(r => [r.id, r as Restaurant])
    )

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const reservation of reservations as Reservation[]) {
      const restaurant = byId.get(reservation.restaurant_id)
      if (!restaurant) {
        failed++
        continue
      }

      const result = await sendReservationNotification(restaurant, reservation, 'reminder')

      if (!('sent' in result)) {
        skipped++
        continue
      }

      // Només marquem quan l'enviament ha reeixit, així un error transitori
      // es reintenta a l'execució de l'endemà.
      const { error: markError } = await supabase
        .from('reservations')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', reservation.id)

      if (markError) {
        console.error('cron recordatoris: error marcant reserva', reservation.id, markError)
        failed++
        continue
      }

      sent++
    }

    return NextResponse.json({ date: target, sent, skipped, failed })
  } catch (err) {
    console.error('cron recordatoris: error intern', err)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
