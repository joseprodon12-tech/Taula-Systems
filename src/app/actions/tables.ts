'use server'

import { db } from '@/db'
import { tables } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { Table } from '@/db/schema'

export async function getTables(restaurantId: string): Promise<Table[]> {
  return db.query.tables.findMany({
    where: (t, { eq }) => eq(t.restaurant_id, restaurantId),
    orderBy: (t, { asc }) => [asc(t.sort_order), asc(t.section)],
  })
}

export async function createTable(restaurantId: string, data: {
  number: string
  section: 'indoor' | 'outdoor'
  capacity: number
}): Promise<{ id: string } | { error: string }> {
  if (!data.number.trim()) return { error: 'El número de taula és obligatori' }

  const existing = await db.query.tables.findMany({
    where: (t, { eq }) => eq(t.restaurant_id, restaurantId),
    columns: { sort_order: true },
  })
  const maxOrder = existing.reduce((m, t) => Math.max(m, t.sort_order), -1)

  const id = crypto.randomUUID()
  await db.insert(tables).values({
    id,
    restaurant_id: restaurantId,
    number: data.number.trim(),
    section: data.section,
    capacity: data.capacity,
    sort_order: maxOrder + 1,
  })

  revalidatePath('/config')
  return { id }
}

export async function updateTable(id: string, data: {
  number: string
  section: 'indoor' | 'outdoor'
  capacity: number
}): Promise<{ ok: true } | { error: string }> {
  if (!data.number.trim()) return { error: 'El número de taula és obligatori' }

  await db.update(tables).set({
    number: data.number.trim(),
    section: data.section,
    capacity: data.capacity,
  }).where(eq(tables.id, id))

  revalidatePath('/config')
  return { ok: true }
}

export async function deleteTable(id: string): Promise<{ ok: true } | { error: string }> {
  // Future: check for linked future reservations via table_id once added to reservations schema
  await db.delete(tables).where(eq(tables.id, id))
  revalidatePath('/config')
  return { ok: true }
}
