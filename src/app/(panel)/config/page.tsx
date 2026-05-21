import { getOrCreateRestaurant, getClosures } from '@/app/actions/config'
import { getTables } from '@/app/actions/tables'
import ConfigClient from './ConfigClient'

export default async function ConfigPage() {
  const restaurant = await getOrCreateRestaurant()
  const [closureList, tableList] = await Promise.all([
    getClosures(restaurant.id),
    getTables(restaurant.id),
  ])
  return <ConfigClient restaurant={restaurant} closures={closureList} tables={tableList} />
}
