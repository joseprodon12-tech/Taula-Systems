import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Taula Systems — Reserves de restaurant',
  description: 'Fes la teva reserva fàcilment',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ca">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
