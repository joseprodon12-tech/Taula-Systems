import type { Restaurant, Reservation, NotificationKind, NotificationResult } from '../types'

// Meta Cloud API — stub. Porta oberta per a implementació futura quan el volum ho justifiqui.
// Cada restaurant necessitarà el seu propi WABA i whatsapp_phone_number_id.
export async function sendWhatsAppMeta(
  _restaurant: Restaurant,
  _reservation: Reservation,
  _kind: NotificationKind
): Promise<NotificationResult> {
  throw new Error('whatsapp-meta: not implemented')
}
