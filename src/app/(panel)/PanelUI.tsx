'use client'

import type { ElementType, ReactNode } from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Settings, LayoutDashboard, CalendarDays, ChevronLeft } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import type { TKey } from '@/lib/i18n'

const NAV_W         = 224
const NAV_W_COMPACT = 48

type Role = 'owner' | 'staff'

interface NavItem { href: string; icon: ElementType; labelKey: TKey }

const BASE_NAV: NavItem[] = [
  { href: '/avui',   icon: LayoutDashboard, labelKey: 'nav.avui'   },
  { href: '/agenda', icon: CalendarDays,    labelKey: 'nav.agenda' },
]
const OWNER_NAV: NavItem[] = [
  { href: '/config', icon: Settings, labelKey: 'nav.config' },
]

export default function PanelUI({ children, role }: { children: ReactNode; role: Role }) {
  const pathname = usePathname()
  const { t } = useT()
  const [compact, setCompact]   = useState(false)
  const [hovered, setHovered]   = useState(false)

  useEffect(() => {
    if (localStorage.getItem('taula_nav') === 'compact') setCompact(true)
  }, [])

  function toggle() {
    const next = !compact
    setCompact(next)
    localStorage.setItem('taula_nav', next ? 'compact' : 'expanded')
  }

  const isExpanded = !compact || hovered
  const navItems   = role === 'owner' ? [...BASE_NAV, ...OWNER_NAV] : BASE_NAV

  function NavLink({ href, icon: Icon, labelKey: tKey }: NavItem) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        className="flex items-center rounded-lg text-sm font-medium transition-colors"
        style={{
          gap: isExpanded ? 12 : 0,
          justifyContent: isExpanded ? 'flex-start' : 'center',
          padding: isExpanded ? '8px 12px' : '10px 0',
          ...(active ? { background: '#EEF2FF', color: 'var(--primary)' } : { color: 'var(--text-muted)' }),
        }}
        title={!isExpanded ? t(tKey) : undefined}
      >
        <Icon size={16} />
        {isExpanded && <span style={{ whiteSpace: 'nowrap' }}>{t(tKey)}</span>}
      </Link>
    )
  }

  return (
    <div className="h-screen overflow-hidden">

      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-20 border-r"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: isExpanded ? NAV_W : NAV_W_COMPACT, background: 'var(--bg)', borderColor: 'var(--border)', transition: 'width 0.2s ease', overflow: 'hidden' }}
      >
        <div
          className="border-b flex items-center"
          style={{ borderColor: 'var(--border)', height: 64, padding: isExpanded ? '0 20px' : 0, justifyContent: isExpanded ? 'space-between' : 'center' }}
        >
          {isExpanded ? (
            <>
              <span className="text-base font-bold" style={{ color: 'var(--primary)', whiteSpace: 'nowrap' }}>Taula Systems</span>
              <button onClick={toggle} className="p-1 rounded-lg hover:bg-gray-100 transition-colors shrink-0" style={{ color: 'var(--text-muted)' }} title="Col·lapsa">
                <ChevronLeft size={16} />
              </button>
            </>
          ) : (
            <button onClick={toggle} className="flex items-center justify-center w-full h-full" style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 20 }} title="Expandeix">
              T
            </button>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => <NavLink key={item.href} {...item} />)}
        </nav>

        <div className="p-2 border-t" style={{ borderColor: 'var(--border)' }}>
          {isExpanded ? (
            <Link href="/reserva/nova" className="btn btn-primary w-full" style={{ whiteSpace: 'nowrap' }}>
              <Plus size={16} />{t('reserva.nova')}
            </Link>
          ) : (
            <Link href="/reserva/nova" className="flex items-center justify-center w-full rounded-lg" style={{ height: 40, background: 'var(--primary)', color: '#fff' }} title={t('reserva.nova')}>
              <Plus size={18} />
            </Link>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className={`flex flex-col h-screen overflow-hidden ${compact ? 'md:ml-12' : 'md:ml-56'}`} style={{ transition: 'margin-left 0.2s ease' }}>
        <header className="flex md:hidden items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>Taula Systems</span>
          {!pathname.startsWith('/avui') && (
            <Link href="/reserva/nova" className="btn btn-primary btn-sm"><Plus size={14} />{t('reserva.nova')}</Link>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>

        {/* Bottom nav — mobile */}
        <nav className="flex md:hidden border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          {navItems.map(({ href, icon: Icon, labelKey: tKey }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} className="flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors" style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}>
                <Icon size={20} />{t(tKey)}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
