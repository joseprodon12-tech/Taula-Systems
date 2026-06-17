'use server'

import { revalidatePath } from 'next/cache'
import { getAuthRestaurant } from '@/lib/auth'
import type { WeeklyHours, Restaurant } from '@/db/schema'

export async function getRestaurant(): Promise<{ restaurant: Restaurant; role: 'owner' | 'staff' }> {
  const { restaurant, role } = await getAuthRestaurant()
  return { restaurant, role }
}

export async function saveRestaurantInfo(id: string, data: {
  name: string
  phone: string
  email: string
  address: string
  city: string
  slug: string
  welcome_message: string
  whatsapp_number: string
}) {
  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase.from('restaurants').update({
    name: data.name,
    phone: data.phone || null,
    email: data.email || null,
    address: data.address || null,
    city: data.city || null,
    slug: data.slug,
    welcome_message: data.welcome_message || null,
    whatsapp_number: data.whatsapp_number || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  revalidatePath('/config')
}

export async function saveWeeklyHours(id: string, weekly_hours: WeeklyHours) {
  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase.from('restaurants').update({
    weekly_hours,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  revalidatePath('/config')
}

export async function saveCapacity(id: string, capacity_indoor: number, capacity_outdoor: number) {
  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase.from('restaurants').update({
    capacity_indoor,
    capacity_outdoor,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  revalidatePath('/config')
}

export async function saveDurations(id: string, lunch: number, dinner: number) {
  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase.from('restaurants').update({
    default_duration_lunch_min: lunch,
    default_duration_dinner_min: dinner,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  revalidatePath('/config')
}

export async function saveNotificationConfig(id: string, data: {
  notification_channel: 'whatsapp' | 'email' | 'none'
  notification_email_from: string
}) {
  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase.from('restaurants').update({
    notification_channel: data.notification_channel,
    notification_email_from: data.notification_email_from.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  revalidatePath('/config')
}

export async function getClosures(restaurantId: string) {
  const { supabase } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('closures')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('date')
  if (error) throw error
  return data
}

export async function addClosure(restaurantId: string, date: string, reason: string) {
  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase.from('closures').insert({
    restaurant_id: restaurantId,
    date,
    reason: reason || null,
  })
  if (error) throw error
  revalidatePath('/config')
}

export async function removeClosure(id: string) {
  const { supabase, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase.from('closures').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/config')
}
