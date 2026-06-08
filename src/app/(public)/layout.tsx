import type { ReactNode } from 'react'

// Minimal layout for public routes — no panel sidebar, no auth wrapper.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
