'use client'

import type { ElementType, ReactNode } from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Settings, LayoutDashboard, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { LocaleProvider, useT } from '@/context/LocaleContext'
import type { TKey } from '@/lib/i18n'

const NAV_W = 224 // w-56 = 14rem

const NAV_ITEMS: { href: string; icon: ElementType; key: TKey }[] = [
  { href: '/avui',   icon: LayoutDashboard, key: 'nav.avui'   },
  { href: '/agenda', icon: CalendarDays,    key: 'nav.agenda' },
  { href: '/config', icon: Settings,        key: 'nav.config' },
]

function PanelUI({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { t } = useT()
  const [navOpen, setNavOpen] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('taula_nav')
    if (saved === 'closed') setNavOpen(false)
  }, [])

  function toggleNav() {
    const next = !navOpen
    setNavOpen(next)
    localStorage.setItem('taula_nav', next ? 'open' : 'closed')
  }

  return (
    <div className="h-screen overflow-hidden">

      {/* Sidebar — fixed, desktop only */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-20 border-r"
        style={{
          width: NAV_W,
          background: 'var(--bg)',
          borderColor: 'var(--border)',
          transform: navOpen ? 'translateX(0)' : `translateX(-${NAV_W}px)`,
          transition: 'transform 0.2s ease',
        }}
      >
        <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <span className="text-base font-bold" style={{ color: 'var(--primary)' }}>Taula Systems</span>
          <button
            onClick={toggleNav}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Amaga la navegació"
          >
            <ChevronLeft size={16} />
          </button>
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

      {/* Expand button — visible only when sidebar is collapsed, desktop only */}
      {!navOpen && (
        <button
          className="hidden md:flex fixed left-3 top-3 z-30 items-center justify-center w-8 h-8 rounded-lg border"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          onClick={toggleNav}
          title="Mostra la navegació"
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Main area — shifts right by nav width on desktop when nav is open */}
      <div
        className={`flex flex-col h-screen overflow-hidden ${navOpen ? 'md:ml-56' : ''}`}
        style={{ transition: 'margin-left 0.2s ease' }}
      >
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
