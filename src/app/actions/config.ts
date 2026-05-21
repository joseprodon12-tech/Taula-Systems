'use server'

import { db } from '@/db'
import { closures, restaurants } from '@/db/schema'
import type { WeeklyHours } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function getOrCreateRestaurant() {
  let restaurant = await db.query.restaurants.findFirst()
  if (!restaurant) {
    const [r] = await db.insert(restaurants).values({
      slug: 'el-meu-restaurant',
      name: 'El meu restaurant',
      capacity_indoor: 30,
      capacity_outdoor: 0,
      weekly_hours: {
        '1': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] },
        '2': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] },
        '3': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] },
        '4': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] },
        '5': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] },
        '6': { lunch: ['13:00', '16:00'] },
        '0': { closed: true },
      },
    }).returning()
    restaurant = r
  }
  return restaurant
}

export async function saveRestaurantInfo(id: string, data: {
  name: string
  phone: string
  email: string
  address: string
  slug: string
}) {
  await db.update(restaurants).set({
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    slug: data.slug,
    updated_at: new Date().toISOString(),
  }).where(eq(restaurants.id, id))
  revalidatePath('/config')
}

export async function saveWeeklyHours(id: string, weekly_hours: WeeklyHours) {
  await db.update(restaurants).set({
    weekly_hours,
    updated_at: new Date().toISOString(),
  }).where(eq(restaurants.id, id))
  revalidatePath('/config')
}

export async function saveCapacity(id: string, capacity_indoor: number, capacity_outdoor: number) {
  await db.update(restaurants).set({
    capacity_indoor,
    capacity_outdoor,
    updated_at: new Date().toISOString(),
  }).where(eq(restaurants.id, id))
  revalidatePath('/config')
}

export async function getClosures(restaurantId: string) {
  return db.query.closures.findMany({
    where: (c, { eq }) => eq(c.restaurant_id, restaurantId),
    orderBy: (c, { asc }) => [asc(c.date)],
  })
}

export async function addClosure(restaurantId: string, date: string, reason: string) {
  await db.insert(closures).values({ restaurant_id: restaurantId, date, reason: reason || null })
  revalidatePath('/config')
}

export async function removeClosure(id: string) {
  await db.delete(closures).where(eq(closures.id, id))
  revalidatePath('/config')
}

export async function saveDurations(id: string, lunch: number, dinner: number) {
  await db.update(restaurants).set({
    default_duration_lunch_min: lunch,
    default_duration_dinner_min: dinner,
    updated_at: new Date().toISOString(),
  }).where(eq(restaurants.id, id))
  revalidatePath('/config')
}
