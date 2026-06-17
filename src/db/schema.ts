export type DayHours = {
  closed?: boolean
  lunch?: [string, string]
  dinner?: [string, string]
}
export type WeeklyHours = Record<string, DayHours>

export type Restaurant = {
  id: string
  slug: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  logo_url: string | null
  welcome_message: string | null
  primary_color: string
  capacity_indoor: number
  capacity_outdoor: number
  weekly_hours: WeeklyHours
  default_duration_lunch_min: number
  default_duration_dinner_min: number
  group_threshold: number
  whatsapp_number: string | null
  notification_channel: 'whatsapp' | 'email' | 'none'
  whatsapp_provider: 'twilio' | 'meta'
  notification_email_from: string | null
  whatsapp_phone_number_id: string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

export type NotificationChannel = 'whatsapp' | 'email' | 'none'
export type WhatsAppProvider = 'twilio' | 'meta'

export type Reservation = {
  id: string
  restaurant_id: string
  date: string
  time: string
  party_size: number
  section: 'indoor' | 'outdoor'
  duration_minutes: number
  customer_name: string
  customer_phone: string
  customer_email: string | null
  notes: string | null
  allergies: string[]
  special_occasion: string | null
  table_number: string | null
  status: 'pending' | 'arrived' | 'no_show' | 'cancelled' | 'standby'
  source: 'phone' | 'widget' | 'manual'
  reminder_sent_at: string | null
  created_at: string
  updated_at: string
}

export type NewReservation = Omit<Reservation, 'id' | 'created_at' | 'updated_at'>

export type Closure = {
  id: string
  restaurant_id: string
  date: string
  reason: string | null
}

export type Table = {
  id: string
  restaurant_id: string
  number: string
  section: 'indoor' | 'outdoor'
  capacity: number
  sort_order: number
}

export type NewTable = Omit<Table, 'id'>

export type Employee = {
  id: string; restaurant_id: string; name: string; role_label: string
  color: string; phone: string | null; contract_hours_week: number | null
  avatar_url: string | null
  sort_order: number; active: boolean; created_at: string; updated_at: string
}

export type Shift = {
  id: string; restaurant_id: string; employee_id: string
  date: string; start_time: string; end_time: string
  zone: string | null; notes: string | null; published: boolean
  created_at: string; updated_at: string
}

export type ShiftWithEmployee = Shift & {
  employee: Pick<Employee, 'id' | 'name' | 'role_label' | 'color' | 'avatar_url'>
}

export type Absence = {
  id: string; restaurant_id: string; employee_id: string
  date_from: string; date_to: string
  type: 'vacances' | 'baixa' | 'lliure' | 'altres'
  notes: string | null; created_at: string
}
