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
