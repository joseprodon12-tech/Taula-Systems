/**
 * Seed script — insereix dades de demo per a /avui i /agenda.
 * Executa: pnpm tsx scripts/seed.ts
 */
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../src/db/schema'
import { restaurants, reservations } from '../src/db/schema'
import { eq } from 'drizzle-orm'

const client = createClient({ url: 'file:./taula.db' })
const db = drizzle(client, { schema })

// ── Dades de demo ──────────────────────────────────────────────────────────────

const NOMS = [
  'Marta Puig', 'Jordi Ferrer', 'Anna Soler', 'Pere Mas', 'Carme Vidal',
  'Marc Bosch', 'Laia Ribas', 'Pau Ginés', 'Núria Font', 'Sergi Molina',
  'Elena García', 'David López', 'Mònica Ruiz', 'Oriol Sala', 'Rosa Blasco',
  'Tomàs Coll', 'Pilar Sanz', 'Raül Dalmau', 'Alba Pons', 'Javier Moreno',
]
const TELS = [
  '600 123 456', '601 234 567', '602 345 678', '603 456 789', '604 567 890',
  '605 678 901', '606 789 012', '607 890 123', '608 901 234', '609 012 345',
  '93 100 20 30', '93 200 30 40', '93 300 40 50', '93 400 50 60',
]
const NOTES_POOL = [
  'Al·lèrgia als fruits secs', 'Terrassa si és possible', 'Aniversari de la Maria — porten pastís',
  'Intolerància al gluten', 'Cadira alta per al nen', 'Celebració de jubilació',
  'Menú del dia sense postre', 'Vegan — sense proteïna animal',
  null, null, null, null, null, // moltes reserves sense notes
]
const FRANGES_DINAR = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30']
const FRANGES_SOPAR = ['20:00', '20:30', '21:00', '21:30', '22:00']
const ESTATS: ('pending' | 'arrived' | 'no_show' | 'cancelled')[] = ['pending', 'arrived', 'no_show', 'cancelled']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

function isoDate(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function makeReservations(
  restaurantId: string,
  date: string,
  count: number,
  forcePending = false,
): schema.NewReservation[] {
  const out: schema.NewReservation[] = []
  for (let i = 0; i < count; i++) {
    const isDinar = Math.random() > 0.35
    out.push({
      restaurant_id: restaurantId,
      date,
      time: isDinar ? pick(FRANGES_DINAR) : pick(FRANGES_SOPAR),
      party_size: Math.floor(Math.random() * 5) + 1 + (Math.random() > 0.8 ? 3 : 0),
      section: Math.random() > 0.4 ? 'indoor' : 'outdoor',
      customer_name: pick(NOMS),
      customer_phone: pick(TELS),
      customer_email: Math.random() > 0.5 ? `demo${i}@example.com` : null,
      notes: pick(NOTES_POOL),
      status: forcePending ? 'pending' : pick(ESTATS),
      source: pick(['phone', 'widget', 'manual']),
    })
  }
  return out
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // Obtenir o crear restaurant
  let restaurant = await db.query.restaurants.findFirst()
  if (!restaurant) {
    const [r] = await db.insert(restaurants).values({
      slug: 'el-meu-restaurant',
      name: 'El meu restaurant',
      capacity_indoor: 30,
      capacity_outdoor: 20,
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
    console.log('✓ Restaurant creat:', restaurant.name)
  } else {
    console.log('✓ Restaurant existent:', restaurant.name)
  }

  // Esborrar reserves existents per netejar
  await db.delete(reservations).where(eq(reservations.restaurant_id, restaurant.id))
  console.log('✓ Reserves anteriors eliminades')

  const toInsert: schema.NewReservation[] = [
    // Avui — 7 reserves, estats mixtos (algunes pending per veure botons)
    ...makeReservations(restaurant.id, isoDate(0), 4, false),
    ...makeReservations(restaurant.id, isoDate(0), 3, true),  // 3 pending garantits
    // Demà — 5 reserves totes pending
    ...makeReservations(restaurant.id, isoDate(1), 5, true),
    // Dia +2
    ...makeReservations(restaurant.id, isoDate(2), 3, true),
    // Dia +3
    ...makeReservations(restaurant.id, isoDate(3), 4, true),
    // Dia +4
    ...makeReservations(restaurant.id, isoDate(4), 2, true),
    // Dia +5
    ...makeReservations(restaurant.id, isoDate(5), 3, true),
    // Dia +6
    ...makeReservations(restaurant.id, isoDate(6), 2, true),
    // Dia +7
    ...makeReservations(restaurant.id, isoDate(7), 3, true),
  ]

  // Inserir noms específics i realistes per avui (overwrite els 3 primers)
  const avui = isoDate(0)
  const specificToday: schema.NewReservation[] = [
    {
      restaurant_id: restaurant.id, date: avui, time: '13:30', party_size: 6,
      section: 'indoor', customer_name: 'Cristina Ruiz', customer_phone: '600 123 456',
      notes: "Al·lèrgia al gluten · Aniversari del Joan, porten pastís",
      status: 'pending', source: 'phone',
    },
    {
      restaurant_id: restaurant.id, date: avui, time: '14:00', party_size: 3,
      section: 'indoor', customer_name: 'Carme Blasco', customer_phone: '601 234 567',
      notes: null, status: 'arrived', source: 'widget',
    },
    {
      restaurant_id: restaurant.id, date: avui, time: '14:30', party_size: 2,
      section: 'outdoor', customer_name: 'Oriol Mas', customer_phone: '93 100 20 30',
      notes: 'Terrassa obligatòriament', status: 'pending', source: 'phone',
    },
    {
      restaurant_id: restaurant.id, date: avui, time: '20:00', party_size: 4,
      section: 'indoor', customer_name: 'Montserrat Puig', customer_phone: '603 456 789',
      notes: null, status: 'pending', source: 'manual',
    },
    {
      restaurant_id: restaurant.id, date: avui, time: '20:30', party_size: 2,
      section: 'indoor', customer_name: 'Carina Lilja', customer_phone: '604 567 890',
      notes: 'Vegan', status: 'pending', source: 'widget',
    },
    {
      restaurant_id: restaurant.id, date: avui, time: '21:00', party_size: 5,
      section: 'outdoor', customer_name: 'Família Gómez', customer_phone: '605 678 901',
      notes: null, status: 'no_show', source: 'phone',
    },
    {
      restaurant_id: restaurant.id, date: avui, time: '14:00', party_size: 2,
      section: 'indoor', customer_name: 'Pere Fontana', customer_phone: '606 789 012',
      notes: 'Cadira alta per al nen', status: 'pending', source: 'phone',
    },
  ]

  // Inserir primer els específics d'avui, la resta del array aleatòria
  const allToInsert = [...specificToday, ...toInsert]
  await db.insert(reservations).values(allToInsert)
  console.log(`✓ ${allToInsert.length} reserves inserides`)
  console.log(`  Avui (${avui}): ${specificToday.length} reserves específiques + ${toInsert.filter(r => r.date === avui).length} aleatòries`)
  console.log('  Properes dates: +1 a +7 dies')
  console.log('\n✅ Seed completat. Obre http://localhost:3001/avui')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
