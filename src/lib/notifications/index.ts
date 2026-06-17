import type { Restaurant, Reservation, NotificationKind, NotificationResult } from './types'
import { sendWhatsAppTwilio } from './channels/whatsapp-twilio'
import { sendWhatsAppMeta } from './channels/whatsapp-meta'
import { sendEmail } from './channels/email'

export async function sendReservationNotification(
  restaurant: Restaurant,
  reservation: Reservation,
  kind: NotificationKind
): Promise<NotificationResult> {
  try {
    switch (restaurant.notification_channel) {
      case 'none':
        return { skipped: true, reason: 'channel_none' }

      case 'email':
        if (!reservation.customer_email) {
          return { skipped: true, reason: 'no_email' }
        }
        return sendEmail(restaurant, reservation, kind)

      case 'whatsapp':
        return restaurant.whatsapp_provider === 'meta'
          ? sendWhatsAppMeta(restaurant, reservation, kind)
          : sendWhatsAppTwilio(restaurant, reservation, kind)
    }
  } catch (err) {
    console.error('notification error', { restaurantId: restaurant.id, kind, err })
    return { skipped: true, reason: 'provider_error' }
  }
}

export type { NotificationKind, NotificationResult }
