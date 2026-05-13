import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import BookingForm from '@/components/BookingForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: { restaurantSlug: string }
}

export default async function BookPage({ params }: Props) {
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.restaurantSlug)
    .single()

  if (error || !restaurant) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-gray-500 mt-1 text-sm">Fes la teva reserva</p>
        </div>
        <BookingForm restaurant={restaurant} />
      </div>
    </main>
  )
}
