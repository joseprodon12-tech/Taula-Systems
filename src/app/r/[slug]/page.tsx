import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import BookingWidget from '@/components/BookingWidget'
import type { Restaurant } from '@/db/schema'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WidgetPage({ params }: Props) {
  const { slug } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !restaurant) notFound()

  return (
    <main className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          {restaurant.logo_url && (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="h-16 w-auto object-contain mx-auto mb-4"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {restaurant.welcome_message || 'Fes la teva reserva'}
          </p>
          {(restaurant.address || restaurant.city) && (
            <p className="text-xs text-gray-400 mt-1">
              {[restaurant.address, restaurant.city].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <BookingWidget restaurant={restaurant as Restaurant} />
      </div>
    </main>
  )
}
