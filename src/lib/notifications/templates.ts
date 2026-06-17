import type { Restaurant, Reservation, NotificationKind } from './types'

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

function formatDate(date: string): string {
  const dateObj = new Date(date + 'T12:00:00')
  return dateObj.toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function buildEmailTemplate(
  restaurant: Restaurant,
  reservation: Reservation,
  kind: NotificationKind
): EmailTemplate {
  const formattedDate = formatDate(reservation.date)
  const pax = reservation.party_size
  const paxText = `${pax} ${pax === 1 ? 'persona' : 'persones'}`
  const name = reservation.customer_name
  const rName = restaurant.name

  // Cap al·lèrgia ni dada de salut — minimització RGPD art. 9
  switch (kind) {
    case 'confirmation':
      return {
        subject: `Reserva confirmada — ${rName}`,
        html: emailHtml({
          title: 'Reserva rebuda',
          greeting: `Hola ${name},`,
          body: `La teva reserva a <strong>${rName}</strong> ha estat rebuda correctament.`,
          details: [
            { label: 'Data', value: formattedDate },
            { label: 'Hora', value: `${reservation.time}h` },
            { label: 'Persones', value: paxText },
          ],
          footer: 'Si necessites canviar o cancel·lar la reserva, contacta amb nosaltres.',
          restaurantName: rName,
        }),
        text: `Reserva rebuda — ${rName}\n\nHola ${name},\nLa teva reserva ha estat rebuda.\n\nData: ${formattedDate}\nHora: ${reservation.time}h\nPersones: ${paxText}\n\nSi necessites canviar, contacta amb nosaltres.`,
      }

    case 'reminder':
      return {
        subject: `Recordatori de reserva — ${rName}`,
        html: emailHtml({
          title: 'Recordatori de reserva',
          greeting: `Hola ${name},`,
          body: `Et recordem la teva reserva de demà a <strong>${rName}</strong>.`,
          details: [
            { label: 'Data', value: formattedDate },
            { label: 'Hora', value: `${reservation.time}h` },
            { label: 'Persones', value: paxText },
          ],
          footer: 'T\'esperem!',
          restaurantName: rName,
        }),
        text: `Recordatori — ${rName}\n\nHola ${name},\nRecordatori de la teva reserva de demà.\n\nData: ${formattedDate}\nHora: ${reservation.time}h\nPersones: ${paxText}\n\nT'esperem!`,
      }

    case 'cancellation':
      return {
        subject: `Reserva cancel·lada — ${rName}`,
        html: emailHtml({
          title: 'Reserva cancel·lada',
          greeting: `Hola ${name},`,
          body: `La teva reserva a <strong>${rName}</strong> ha estat cancel·lada.`,
          details: [
            { label: 'Data', value: formattedDate },
            { label: 'Hora', value: `${reservation.time}h` },
          ],
          footer: 'Si vols fer una nova reserva, pots contactar amb nosaltres.',
          restaurantName: rName,
        }),
        text: `Reserva cancel·lada — ${rName}\n\nHola ${name},\nLa teva reserva del ${formattedDate} a les ${reservation.time}h ha estat cancel·lada.\n\nSi vols fer una nova reserva, contacta amb nosaltres.`,
      }
  }
}

interface EmailHtmlProps {
  title: string
  greeting: string
  body: string
  details: { label: string; value: string }[]
  footer: string
  restaurantName: string
}

function emailHtml({ title, greeting, body, details, footer, restaurantName }: EmailHtmlProps): string {
  const detailRows = details.map(d =>
    `<tr><td style="padding:6px 0;color:#6B6560;font-size:14px;width:90px">${d.label}</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:#1A1A18">${d.value}</td></tr>`
  ).join('')

  return `<!DOCTYPE html>
<html lang="ca">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
    <table width="100%" style="max-width:480px" cellpadding="0" cellspacing="0">
      <tr><td style="text-align:center;padding-bottom:24px">
        <span style="font-size:24px;font-weight:800;letter-spacing:-.5px;color:#1A1A18">Taula<span style="color:#C4472A">.</span></span>
      </td></tr>
      <tr><td style="background:#fff;border:1px solid #E5DDD5;border-radius:16px;padding:32px">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1A1A18">${title}</p>
        <p style="margin:0 0 20px;font-size:14px;color:#6B6560">${greeting}</p>
        <p style="margin:0 0 20px;font-size:14px;color:#1A1A18;line-height:1.6">${body}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E5DDD5;padding-top:16px;margin-top:4px">
          ${detailRows}
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#6B6560;line-height:1.6">${footer}</p>
      </td></tr>
      <tr><td style="text-align:center;padding-top:20px">
        <p style="margin:0;font-size:12px;color:#9CA3AF">${restaurantName} · gestionat amb Taula Systems</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`
}
