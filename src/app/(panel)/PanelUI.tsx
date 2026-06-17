'use client'

import type { ElementType, ReactNode } from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { Plus, Settings, LayoutDashboard, CalendarDays, ChevronLeft, Users } from 'lucide-react'
import { useT } from '@/context/LocaleContext'
import type { TKey } from '@/lib/i18n'

const NAV_W         = 224
const NAV_W_COMPACT = 48

type Role = 'owner' | 'staff'

interface NavItem { href: string; icon: ElementType; labelKey: TKey }

const BASE_NAV: NavItem[] = [
  { href: '/avui',   icon: LayoutDashboard, labelKey: 'nav.avui'   },
  { href: '/agenda', icon: CalendarDays,    labelKey: 'nav.agenda' },
  { href: '/equip',  icon: Users,           labelKey: 'nav.equip'  },
]
const OWNER_NAV: NavItem[] = [
  { href: '/config', icon: Settings, labelKey: 'nav.config' },
]

export default function PanelUI({ children, role }: { children: ReactNode; role: Role }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useT()
  const [compact, setCompact]   = useState(false)
  const [hovered, setHovered]   = useState(false)
  const [showSheet, setShowSheet] = useState(false)

  const showFab = pathname.startsWith('/avui') || pathname.startsWith('/agenda') || pathname.startsWith('/equip')
  // A /equip el FAB mostra també "Nou torn"; EquipClient escolta l'event 'equip:nou-torn' per obrir l'editor
  const isEquip = pathname.startsWith('/equip')

  function handleNovaReserva() {
    const data = searchParams.get('data')
    router.push(data ? `/reserva/nova?data=${data}` : '/reserva/nova')
    setShowSheet(false)
  }

  function handleNouTorn() {
    if (isEquip) {
      document.dispatchEvent(new CustomEvent('equip:nou-torn'))
    } else {
      const data = searchParams.get('data')
      router.push(data ? `/equip?nou-torn=1&data=${data}` : '/equip?nou-torn=1')
    }
    setShowSheet(false)
  }

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
          ...(active ? { background: 'var(--primary-soft)', color: 'var(--primary)' } : { color: 'var(--text-muted)' }),
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

      {/* Sidebar — desktop (lg+) */}
      <aside
        className="hidden xl:flex flex-col fixed left-0 top-0 bottom-0 z-20 border-r"
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
      <div className={`flex flex-col h-screen overflow-hidden ${compact ? 'xl:ml-12' : 'xl:ml-56'}`} style={{ transition: 'margin-left 0.2s ease' }}>
        <header className="flex xl:hidden items-center justify-between px-4 py-3 border-b" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>Taula Systems</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>

        {/* Bottom nav — mobile + tablet */}
        <nav className="flex xl:hidden border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
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

      {/* ── FAB global (avui + agenda) — ocult a desktop on el sidebar ja té el botó ── */}
      {showFab && (
        <button
          onClick={() => setShowSheet(true)}
          className="xl:hidden fixed z-40 flex items-center justify-center shadow-lg"
          style={{
            bottom: 80, right: 16,
            width: 56, height: 56,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: '#fff',
          }}
          aria-label={t('reserva.nova')}
        >
          <Plus size={24} />
        </button>
      )}

      {/* ── Action sheet ── */}
      {showSheet && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setShowSheet(false)}
          />
          <div
            className="fixed left-0 right-0 z-50"
            style={{
              bottom: 0,
              padding: '0 16px 32px',
              animation: 'sheet-up 0.25s ease',
            }}
          >
            <style>{`@keyframes sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>

            {/* Grup d'accions */}
            <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg)', marginBottom: 10 }}>
              <div style={{ padding: '8px 0 4px', textAlign: 'center' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 12px' }} />
              </div>
              <button
                onClick={handleNouTorn}
                style={{
                  width: '100%', padding: '16px 20px',
                  fontSize: 17, fontWeight: 600,
                  color: 'var(--primary)',
                  textAlign: 'center',
                  background: 'none', border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {t('equip.torn.nou')}
              </button>
              <button
                onClick={handleNovaReserva}
                style={{
                  width: '100%', padding: '16px 20px',
                  fontSize: 17, fontWeight: 600,
                  color: 'var(--primary)',
                  textAlign: 'center',
                  background: 'none', border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('reserva.nova')}
              </button>
            </div>

            {/* Cancel·lar separat */}
            <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg)' }}>
              <button
                onClick={() => setShowSheet(false)}
                style={{
                  width: '100%', padding: '16px 20px',
                  fontSize: 17, fontWeight: 600,
                  color: 'var(--text)',
                  textAlign: 'center',
                  background: 'none', border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel·lar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
