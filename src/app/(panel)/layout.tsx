'use client'

import type { ElementType, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Settings, LayoutDashboard, CalendarDays } from 'lucide-react'
import { LocaleProvider, useT } from '@/context/LocaleContext'
import type { TKey } from '@/lib/i18n'

const NAV_ITEMS: { href: string; icon: ElementType; key: TKey }[] = [
  { href: '/avui',   icon: LayoutDashboard, key: 'nav.avui'   },
  { href: '/agenda', icon: CalendarDays,    key: 'nav.agenda' },
  { href: '/config', icon: Settings,        key: 'nav.config' },
]

function PanelUI({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { t } = useT()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0 border-r"
        aria-label="Navegació principal"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-base font-bold" style={{ color: 'var(--primary)' }}>Taula Systems</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, key }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={active ? { background: '#EEF2FF', color: 'var(--primary)' } : { color: 'var(--text-muted)' }}
              >
                <Icon size={16} />
                {t(key)}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <Link href="/reserva/nova" className="btn btn-primary w-full">
            <Plus size={16} />
            {t('reserva.nova')}
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header
          className="flex md:hidden items-center justify-between px-4 py-3 border-b"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>Taula Systems</span>
          {!pathname.startsWith('/avui') && (
            <Link href="/reserva/nova" className="btn btn-primary btn-sm">
              <Plus size={14} />
              {t('reserva.nova')}
            </Link>
          )}
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="flex md:hidden border-t"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          {NAV_ITEMS.map(({ href, icon: Icon, key }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors"
                style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                <Icon size={20} />
                {t(key)}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <PanelUI>{children}</PanelUI>
    </LocaleProvider>
  )
}
