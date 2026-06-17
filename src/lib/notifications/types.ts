import type { Restaurant, Reservation } from '@/db/schema'

export type NotificationKind = 'confirmation' | 'reminder' | 'cancellation'

export type NotificationResult =
  | { sent: true }
  | { skipped: true; reason: 'channel_none' | 'no_email' | 'no_phone' | 'provider_error' | 'not_implemented' }

export type { Restaurant, Reservation }
