import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getAuthRestaurant } from '@/lib/auth'
import { LocaleProvider } from '@/context/LocaleContext'
import PanelUI from './PanelUI'

export default async function PanelLayout({ children }: { children: ReactNode }) {
  let role: 'owner' | 'staff'
  try {
    const auth = await getAuthRestaurant()
    role = auth.role
  } catch {
    redirect('/login')
  }

  return (
    <LocaleProvider>
      <PanelUI role={role!}>{children}</PanelUI>
    </LocaleProvider>
  )
}
