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

  const primaryColor = restaurant.primary_color || '#2563EB'

  return (
    <main
      className="min-h-screen bg-gray-50"
      style={{ '--primary': primaryColor } as React.CSSProperties}
    >
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          {restaurant.logo_url && (
            <div className="mb-4 flex justify-center">
              <img
                src={restaurant.logo_url}
                alt={`Logo ${restaurant.name}`}
                className="h-16 w-auto object-contain"
              />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
          {restaurant.welcome_message ? (
            <p className="text-gray-500 mt-1 text-sm">{restaurant.welcome_message}</p>
          ) : (
            <p className="text-gray-500 mt-1 text-sm">Fes la teva reserva</p>
          )}
          {(restaurant.address || restaurant.city) && (
            <p className="text-gray-400 mt-1 text-xs flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {[restaurant.address, restaurant.city].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <BookingForm restaurant={restaurant} />
      </div>
    </main>
  )
}
