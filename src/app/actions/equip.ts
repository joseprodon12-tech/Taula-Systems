'use server'

import { revalidatePath } from 'next/cache'
import { getAuthRestaurant } from '@/lib/auth'
import { addDays } from '@/lib/dates'
import type { Employee, Shift, Absence } from '@/db/schema'
import { toMin, shiftsOverlap } from '@/lib/labor'

// ─── Empleats ────────────────────────────────────────────────────────────────

export async function getEmployees(opts?: { includeInactive?: boolean }): Promise<Employee[]> {
  const { supabase, restaurant } = await getAuthRestaurant()
  let query = supabase
    .from('employees')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('sort_order')
  if (!opts?.includeInactive) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return data as Employee[]
}

export async function createEmployee(data: {
  name: string
  role_label: string
  color: string
  phone?: string
  contract_hours_week?: number
  avatar_url?: string
}): Promise<{ id: string } | { error: string; fieldErrors?: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {}
  if (!data.name.trim()) fieldErrors.name = 'El nom és obligatori'
  if (!data.role_label.trim()) fieldErrors.role_label = 'El rol és obligatori'
  if (!data.color.trim()) fieldErrors.color = 'El color és obligatori'
  if (Object.keys(fieldErrors).length) return { error: 'Comprova els camps obligatoris', fieldErrors }

  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { data: existing } = await supabase
    .from('employees')
    .select('sort_order')
    .eq('restaurant_id', restaurant.id)

  const maxOrder = (existing || []).reduce(
    (m: number, e: { sort_order: number }) => Math.max(m, e.sort_order),
    -1,
  )

  const { data: newEmp, error: insertError } = await supabase
    .from('employees')
    .insert({
      restaurant_id: restaurant.id,
      name: data.name.trim(),
      role_label: data.role_label.trim(),
      color: data.color,
      phone: data.phone?.trim() || null,
      contract_hours_week: data.contract_hours_week ?? null,
      avatar_url: data.avatar_url ?? null,
      sort_order: maxOrder + 1,
    })
    .select('id')
    .single()

  if (insertError) return { error: "Error en crear l'empleat" }

  revalidatePath('/equip')
  revalidatePath('/equip/empleats')
  return { id: newEmp.id }
}

export async function updateEmployee(
  id: string,
  data: {
    name: string
    role_label: string
    color: string
    phone: string | null
    contract_hours_week: number | null
    avatar_url?: string | null
  },
): Promise<{ ok: true } | { error: string }> {
  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase
    .from('employees')
    .update({
      name: data.name.trim(),
      role_label: data.role_label.trim(),
      color: data.color,
      phone: data.phone?.trim() || null,
      contract_hours_week: data.contract_hours_week,
      ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: "Error en actualitzar l'empleat" }

  revalidatePath('/equip')
  revalidatePath('/equip/empleats')
  return { ok: true }
}

export async function deactivateEmployee(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase
    .from('employees')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: "Error en desactivar l'empleat" }

  revalidatePath('/equip')
  revalidatePath('/equip/empleats')
  return { ok: true }
}

export async function reactivateEmployee(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase
    .from('employees')
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: "Error en reactivar l'empleat" }

  revalidatePath('/equip')
  revalidatePath('/equip/empleats')
  return { ok: true }
}

// ─── Torns ────────────────────────────────────────────────────────────────────

export async function getShiftsForWeek(
  monday: string,
  sunday: string,
): Promise<Record<string, Shift[]>> {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .gte('date', monday)
    .lte('date', sunday)
    .order('date')
    .order('start_time')
  if (error) throw error

  const map: Record<string, Shift[]> = {}
  for (const s of data as Shift[]) {
    if (!map[s.date]) map[s.date] = []
    map[s.date].push(s)
  }
  return map
}

export async function createShift(data: {
  employee_id: string
  date: string
  start_time: string
  end_time: string
  zone?: string
  notes?: string
}): Promise<{ id: string } | { error: string; fieldErrors?: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {}
  if (!data.employee_id) fieldErrors.employee_id = "L'empleat és obligatori"
  if (!data.date) fieldErrors.date = 'La data és obligatòria'
  if (!data.start_time) fieldErrors.start_time = "L'hora d'inici és obligatòria"
  if (!data.end_time) fieldErrors.end_time = "L'hora de fi és obligatòria"
  if (Object.keys(fieldErrors).length) return { error: 'Comprova els camps obligatoris', fieldErrors }

  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { data: existing } = await supabase
    .from('shifts')
    .select('start_time, end_time')
    .eq('restaurant_id', restaurant.id)
    .eq('employee_id', data.employee_id)
    .eq('date', data.date)

  if (existing?.length) {
    const rStart = toMin(data.start_time), rEnd = toMin(data.end_time)
    const hasOverlap = existing.some((s: { start_time: string; end_time: string }) => {
      return shiftsOverlap(rStart, rEnd, toMin(s.start_time), toMin(s.end_time))
    })
    if (hasOverlap) return {
      error: "L'empleat ja té un torn en aquest interval",
      fieldErrors: { start_time: "Aquest empleat ja té un torn en aquest interval" },
    }
  }

  const { data: newShift, error: insertError } = await supabase
    .from('shifts')
    .insert({
      restaurant_id: restaurant.id,
      employee_id: data.employee_id,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      zone: data.zone?.trim() || null,
      notes: data.notes?.trim() || null,
      published: false,
    })
    .select('id')
    .single()

  if (insertError) return { error: 'Error en crear el torn' }

  revalidatePath('/equip')
  return { id: newShift.id }
}

export async function updateShift(
  id: string,
  data: {
    employee_id: string
    date: string
    start_time: string
    end_time: string
    zone?: string | null
    notes?: string | null
  },
): Promise<{ ok: true } | { error: string; fieldErrors?: Record<string, string> }> {
  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { data: existing } = await supabase
    .from('shifts')
    .select('start_time, end_time')
    .eq('restaurant_id', restaurant.id)
    .eq('employee_id', data.employee_id)
    .eq('date', data.date)
    .neq('id', id)

  if (existing?.length) {
    const rStart = toMin(data.start_time), rEnd = toMin(data.end_time)
    const hasOverlap = existing.some((s: { start_time: string; end_time: string }) => {
      return shiftsOverlap(rStart, rEnd, toMin(s.start_time), toMin(s.end_time))
    })
    if (hasOverlap) return {
      error: "L'empleat ja té un torn en aquest interval",
      fieldErrors: { start_time: "Aquest empleat ja té un torn en aquest interval" },
    }
  }

  const { error } = await supabase
    .from('shifts')
    .update({
      employee_id: data.employee_id,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      zone: data.zone?.trim() || null,
      notes: data.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: 'Error en actualitzar el torn' }

  revalidatePath('/equip')
  return { ok: true }
}

export async function deleteShift(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: 'Error en eliminar el torn' }

  revalidatePath('/equip')
  return { ok: true }
}

export async function duplicateWeek(
  fromMonday: string,
  toMonday: string,
): Promise<{ created: number; skipped: number } | { error: string }> {
  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const fromSunday = addDays(fromMonday, 6)
  const toSunday = addDays(toMonday, 6)

  const [{ data: sourceShifts }, { data: activeEmployees }, { data: destAbsences }] =
    await Promise.all([
      supabase
        .from('shifts')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .gte('date', fromMonday)
        .lte('date', fromSunday),
      supabase
        .from('employees')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('active', true),
      supabase
        .from('absences')
        .select('employee_id, date_from, date_to')
        .eq('restaurant_id', restaurant.id)
        .lte('date_from', toSunday)
        .gte('date_to', toMonday),
    ])

  if (!sourceShifts?.length) return { created: 0, skipped: 0 }

  const activeIds = new Set((activeEmployees || []).map((e: { id: string }) => e.id))

  const [fy, fm, fd] = fromMonday.split('-').map(Number)
  const [ty, tm, td] = toMonday.split('-').map(Number)
  const dayDiff = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000,
  )

  type AbsenceRow = { employee_id: string; date_from: string; date_to: string }
  const absences = (destAbsences || []) as AbsenceRow[]

  let created = 0
  let skipped = 0
  const toInsert: object[] = []

  for (const s of sourceShifts as Shift[]) {
    if (!activeIds.has(s.employee_id)) { skipped++; continue }

    const destDate = addDays(s.date, dayDiff)
    const hasAbsence = absences.some(
      a => a.employee_id === s.employee_id && a.date_from <= destDate && a.date_to >= destDate,
    )
    if (hasAbsence) { skipped++; continue }

    toInsert.push({
      restaurant_id: restaurant.id,
      employee_id: s.employee_id,
      date: destDate,
      start_time: s.start_time,
      end_time: s.end_time,
      zone: s.zone,
      notes: s.notes,
      published: false,
    })
    created++
  }

  if (toInsert.length) {
    const { error } = await supabase.from('shifts').insert(toInsert)
    if (error) return { error: 'Error en duplicar la setmana' }
  }

  revalidatePath('/equip')
  return { created, skipped }
}

export async function publishWeek(
  monday: string,
): Promise<{ published: number } | { error: string }> {
  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const sunday = addDays(monday, 6)
  const { data, error } = await supabase
    .from('shifts')
    .update({ published: true, updated_at: new Date().toISOString() })
    .eq('restaurant_id', restaurant.id)
    .gte('date', monday)
    .lte('date', sunday)
    .eq('published', false)
    .select('id')

  if (error) return { error: 'Error en publicar la setmana' }

  revalidatePath('/equip')
  return { published: data?.length ?? 0 }
}

// ─── Absències ────────────────────────────────────────────────────────────────

export async function getAbsencesForRange(from: string, to: string): Promise<Absence[]> {
  const { supabase, restaurant } = await getAuthRestaurant()
  const { data, error } = await supabase
    .from('absences')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .lte('date_from', to)
    .gte('date_to', from)
    .order('date_from')
  if (error) throw error
  return data as Absence[]
}

export async function createAbsence(data: {
  employee_id: string
  date_from: string
  date_to: string
  type: 'vacances' | 'baixa' | 'lliure' | 'altres'
  notes?: string
}): Promise<{ id: string } | { error: string; fieldErrors?: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {}
  if (!data.date_from) fieldErrors.date_from = "La data d'inici és obligatòria"
  if (!data.date_to) fieldErrors.date_to = 'La data de fi és obligatòria'
  if (data.date_from && data.date_to && data.date_from > data.date_to)
    fieldErrors.date_to = "La data de fi ha de ser igual o posterior a l'inici"
  if (Object.keys(fieldErrors).length) return { error: 'Comprova els camps obligatoris', fieldErrors }

  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { data: newAbs, error: insertError } = await supabase
    .from('absences')
    .insert({
      restaurant_id: restaurant.id,
      employee_id: data.employee_id,
      date_from: data.date_from,
      date_to: data.date_to,
      type: data.type,
      notes: data.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (insertError) return { error: "Error en crear l'absència" }

  revalidatePath('/equip')
  return { id: newAbs.id }
}

export async function deleteAbsence(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase, restaurant, role } = await getAuthRestaurant()
  if (role !== 'owner') return { error: 'Sense permisos' }

  const { error } = await supabase
    .from('absences')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) return { error: "Error en eliminar l'absència" }

  revalidatePath('/equip')
  return { ok: true }
}
