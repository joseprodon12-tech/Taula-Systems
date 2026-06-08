import { redirect } from 'next/navigation'
import { getRestaurant, getClosures } from '@/app/actions/config'
import { getTables } from '@/app/actions/tables'
import ConfigClient from './ConfigClient'

export default async function ConfigPage() {
  const { restaurant, role } = await getRestaurant()
  if (role !== 'owner') redirect('/avui')

  const [closureList, tableList] = await Promise.all([
    getClosures(restaurant.id),
    getTables(restaurant.id),
  ])
  return <ConfigClient restaurant={restaurant} closures={closureList} tables={tableList} />
}
