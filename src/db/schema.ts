import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const restaurants = sqliteTable('restaurants', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  capacity_indoor: integer('capacity_indoor').notNull().default(30),
  capacity_outdoor: integer('capacity_outdoor').notNull().default(0),
  // {0:{lunch:["13:00","16:00"],dinner:["20:00","23:00"]}, 1:..., 6:{closed:true}}
  weekly_hours: text('weekly_hours', { mode: 'json' }).$type<WeeklyHours>().notNull().default({} as WeeklyHours),
  default_duration_lunch_min:  integer('default_duration_lunch_min').notNull().default(90),
  default_duration_dinner_min: integer('default_duration_dinner_min').notNull().default(120),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const reservations = sqliteTable('reservations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  restaurant_id: text('restaurant_id').notNull().references(() => restaurants.id),
  date: text('date').notNull(),    // 2026-05-14
  time: text('time').notNull(),    // 14:00
  party_size: integer('party_size').notNull(),
  section: text('section', { enum: ['indoor', 'outdoor'] }).notNull().default('indoor'),
  duration_minutes: integer('duration_minutes').notNull().default(90),
  customer_name: text('customer_name').notNull(),
  customer_phone: text('customer_phone').notNull(),
  customer_email: text('customer_email'),
  notes: text('notes'),
  table_number: text('table_number'),
  status: text('status', { enum: ['pending', 'arrived', 'no_show', 'cancelled'] }).notNull().default('pending'),
  source: text('source', { enum: ['phone', 'widget', 'manual'] }).notNull().default('manual'),
  reminder_sent_at: text('reminder_sent_at'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const closures = sqliteTable('closures', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  restaurant_id: text('restaurant_id').notNull().references(() => restaurants.id),
  date: text('date').notNull(),
  reason: text('reason'),
})

export const tables = sqliteTable('tables', {
  id:            text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  restaurant_id: text('restaurant_id').notNull().references(() => restaurants.id),
  number:        text('number').notNull(),
  section:       text('section', { enum: ['indoor', 'outdoor'] }).notNull(),
  capacity:      integer('capacity').notNull(),
  sort_order:    integer('sort_order').notNull().default(0),
})

export type Restaurant = typeof restaurants.$inferSelect
export type NewRestaurant = typeof restaurants.$inferInsert
export type Reservation = typeof reservations.$inferSelect
export type NewReservation = typeof reservations.$inferInsert
export type Closure = typeof closures.$inferSelect
export type Table = typeof tables.$inferSelect
export type NewTable = typeof tables.$inferInsert

export type DayHours = {
  closed?: boolean
  lunch?: [string, string]   // [start, end] ex: ["13:00", "16:00"]
  dinner?: [string, string]
}
export type WeeklyHours = Record<string, DayHours>  // key = "0".."6" (0=diumenge)
