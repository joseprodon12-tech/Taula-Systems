import type { Restaurant, Reservation, NotificationKind, NotificationResult } from './types'
import { sendWhatsAppTwilio, sendOwnerAlertTwilio } from './channels/whatsapp-twilio'
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

export async function sendOwnerAlert(
  restaurant: Restaurant,
  reservation: Reservation,
): Promise<NotificationResult> {
  try {
    if (!restaurant.whatsapp_number) return { skipped: true, reason: 'no_phone' }
    // Owner alerts always via Twilio regardless of customer channel
    return sendOwnerAlertTwilio(restaurant, reservation)
  } catch (err) {
    console.error('owner alert error', { restaurantId: restaurant.id, err })
    return { skipped: true, reason: 'provider_error' }
  }
}

export type { NotificationKind, NotificationResult }
