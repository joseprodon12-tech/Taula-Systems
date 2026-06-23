import type { Restaurant, Reservation, NotificationKind, NotificationResult } from '../types'

export async function sendWhatsAppTwilio(
  restaurant: Restaurant,
  reservation: Reservation,
  kind: NotificationKind
): Promise<NotificationResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !from || !restaurant.whatsapp_number) {
    return { skipped: true, reason: 'no_phone' }
  }

  const twilio = (await import('twilio')).default
  const client = twilio(accountSid, authToken)

  const toNumber = reservation.customer_phone.startsWith('+')
    ? reservation.customer_phone
    : `+34${reservation.customer_phone.replace(/\s/g, '')}`

  const body = buildWhatsAppBody(restaurant, reservation, kind)

  await client.messages.create({ from, to: `whatsapp:${toNumber}`, body })
  return { sent: true }
}

export async function sendOwnerAlertTwilio(
  restaurant: Restaurant,
  reservation: Reservation,
): Promise<NotificationResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !from || !restaurant.whatsapp_number) {
    return { skipped: true, reason: 'no_phone' }
  }

  const twilio = (await import('twilio')).default
  const client = twilio(accountSid, authToken)

  const ownerNumber = restaurant.whatsapp_number.startsWith('+')
    ? restaurant.whatsapp_number
    : `+34${restaurant.whatsapp_number.replace(/\s/g, '')}`

  const dateObj = new Date(reservation.date + 'T12:00:00')
  const formattedDate = dateObj.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const pax = reservation.party_size
  const extras = [
    reservation.notes,
    reservation.special_occasion,
    (reservation.allergies?.length ?? 0) > 0 ? `Al·lèrgies: ${reservation.allergies!.join(', ')}` : null,
  ].filter(Boolean).join(' · ')

  const body = `🔔 *Nova reserva online* — ${restaurant.name}\n\n👤 ${reservation.customer_name}\n📅 ${formattedDate} · ${reservation.time}h\n👥 ${pax} ${pax === 1 ? 'persona' : 'persones'}${extras ? `\n📝 ${extras}` : ''}\n\n📱 ${reservation.customer_phone}`

  await client.messages.create({ from, to: `whatsapp:${ownerNumber}`, body })
  return { sent: true }
}

function buildWhatsAppBody(restaurant: Restaurant, reservation: Reservation, kind: NotificationKind): string {
  const dateObj = new Date(reservation.date + 'T12:00:00')
  const formattedDate = dateObj.toLocaleDateString('ca-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const pax = reservation.party_size
  const paxText = `${pax} ${pax === 1 ? 'persona' : 'persones'}`

  switch (kind) {
    case 'confirmation':
      return `🍽️ *${restaurant.name}*\n\nHola ${reservation.customer_name}! La teva reserva ha estat rebuda.\n\n📅 ${formattedDate}\n🕐 ${reservation.time}h\n👥 ${paxText}\n\nEn 24 hores rebràs un recordatori. Si necessites canviar, respon a aquest missatge.`
    case 'reminder':
      return `🍽️ *${restaurant.name}*\n\nHola ${reservation.customer_name}! Et recordem la teva reserva de demà.\n\n📅 ${formattedDate}\n🕐 ${reservation.time}h\n👥 ${paxText}\n\nEt esperem!`
    case 'cancellation':
      return `🍽️ *${restaurant.name}*\n\nHola ${reservation.customer_name}. La teva reserva del ${formattedDate} a les ${reservation.time}h ha estat cancel·lada.\n\nSi vols fer una nova reserva, pots contactar-nos.`
  }
}
