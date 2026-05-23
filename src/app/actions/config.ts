'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WeeklyHours, Restaurant } from '@/db/schema'

async function getAuthRestaurant() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('No autenticat')

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  return { supabase, user, restaurant: restaurant as Restaurant | null }
}

export async function getOrCreateRestaurant(): Promise<Restaurant> {
  const { supabase, user, restaurant } = await getAuthRestaurant()
  if (restaurant) return restaurant

  const slug = `restaurant-${user.id.substring(0, 8)}`
  const { data, error } = await supabase.from('restaurants').insert({
    slug,
    name: 'El meu restaurant',
    owner_id: user.id,
    primary_color: '#C17B2F',
    capacity_indoor: 30,
    capacity_outdoor: 0,
    default_duration_lunch_min: 90,
    default_duration_dinner_min: 110,
    group_threshold: 6,
    weekly_hours: {
      monday: { closed: true },
      tuesday: { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] },
      wednesday: { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] },
      thursday: { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] },
      friday: { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] },
      saturday: { lunch: ['13:00', '16:30'], dinner: ['20:00', '23:30'] },
      sunday: { lunch: ['13:00', '16:00'] },
    },
  }).select().single()
  if (error) throw error
  return data as Restaurant
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
  const { supabase } = await getAuthRestaurant()
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
  const { supabase } = await getAuthRestaurant()
  const { error } = await supabase.from('restaurants').update({
    weekly_hours,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  revalidatePath('/config')
}

export async function saveCapacity(id: string, capacity_indoor: number, capacity_outdoor: number) {
  const { supabase } = await getAuthRestaurant()
  const { error } = await supabase.from('restaurants').update({
    capacity_indoor,
    capacity_outdoor,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  revalidatePath('/config')
}

export async function saveDurations(id: string, lunch: number, dinner: number) {
  const { supabase } = await getAuthRestaurant()
  const { error } = await supabase.from('restaurants').update({
    default_duration_lunch_min: lunch,
    default_duration_dinner_min: dinner,
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
  const { supabase } = await getAuthRestaurant()
  const { error } = await supabase.from('closures').insert({
    restaurant_id: restaurantId,
    date,
    reason: reason || null,
  })
  if (error) throw error
  revalidatePath('/config')
}

export async function removeClosure(id: string) {
  const { supabase } = await getAuthRestaurant()
  const { error } = await supabase.from('closures').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/config')
}
