import { getRestaurant } from '@/app/actions/config'
import { getEmployees } from '@/app/actions/equip'
import EmplatsClient from './EmplatsClient'

export default async function EmplatsPage() {
  const [{ role }, employees] = await Promise.all([
    getRestaurant(),
    getEmployees({ includeInactive: true }),
  ])

  return <EmplatsClient employees={employees} role={role} />
}
