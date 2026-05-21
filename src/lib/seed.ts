// Run once to insert demo restaurant. Call from a script or dev route.
import { db } from '@/db'
import { restaurants } from '@/db/schema'

export async function seedDemoRestaurant() {
  const existing = await db.query.restaurants.findFirst({
    where: (r, { eq }) => eq(r.slug, 'demo'),
  })
  if (existing) return existing

  const [restaurant] = await db.insert(restaurants).values({
    slug: 'demo',
    name: 'Restaurant Demo',
    phone: '600 000 000',
    email: 'demo@taula.systems',
    address: 'Carrer de la Demo, 1, Barcelona',
    capacity_indoor: 30,
    capacity_outdoor: 20,
    weekly_hours: {
      '1': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] }, // dl
      '2': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] }, // dt
      '3': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] }, // dc
      '4': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] }, // dj
      '5': { lunch: ['13:00', '16:00'], dinner: ['20:00', '23:00'] }, // dv
      '6': { lunch: ['13:00', '16:00'] },                             // ds
      '0': { closed: true },                                           // dg
    },
  }).returning()
  return restaurant
}
