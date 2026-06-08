'use client'

import { useState } from 'react'
import Link from 'next/link'
import GanttMockup   from './(public)/gantt-mockup'
import ReservesMockup from './(public)/reserves-mockup'

type Locale = 'ca' | 'es'

const T = {
  ca: {
    navReserves: 'Reserves',
    navHoraris:  'Horaris',
    navLogin:    'Inicia sessió',
    eyebrow:     'Gestió per a restaurants',
    headline:    'Gestiona Reserves i Horaris Fàcil!',
    sub:         'Substitueix la llibreta de paper sense complicar-te la vida. Fet per a restaurants familiars.',
    ctaHero:     'Parla amb nosaltres →',
    panelHoraris:'Horaris · Vista del dia',
    sync:        'Sincronitzat',
    ctaH:        'Interessat? Parlem.',
    ctaP:        "T'expliquem com funciona i ho configurem junts des del primer dia.",
    ctaBtn:      "Contacta'ns →",
    privacy:     'Privacitat',
    terms:       "Termes d'ús",
  },
  es: {
    navReserves: 'Reservas',
    navHoraris:  'Horarios',
    navLogin:    'Iniciar sesión',
    eyebrow:     'Gestión para restaurantes',
    headline:    '¡Gestiona Reservas y Horarios Fácil!',
    sub:         'Sustituye la libreta de papel sin complicarte la vida. Hecho para restaurantes familiares.',
    ctaHero:     'Habla con nosotros →',
    panelHoraris:'Horarios · Vista del día',
    sync:        'Sincronizado',
    ctaH:        '¿Interesado? Hablemos.',
    ctaP:        'Te explicamos cómo funciona y lo configuramos juntos desde el primer día.',
    ctaBtn:      'Contáctanos →',
    privacy:     'Privacidad',
    terms:       'Términos de uso',
  },
}

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>('ca')
  const t = T[locale]

  return (
    <div className="landing-page" style={{ minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', WebkitFontSmoothing: 'antialiased' }}>

      {/* ── Nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(250,250,249,.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/" style={{ fontSize: 17, fontWeight: 800, letterSpacing: -.4, color: 'var(--text)', textDecoration: 'none' }}>
            Taula<em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>.</em>
          </a>
          <ul style={{ display: 'flex', gap: 20, listStyle: 'none', marginLeft: 12 }} className="nav-links-v2">
            <li><a href="#reserves" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>{t.navReserves}</a></li>
            <li><a href="#horaris"  style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>{t.navHoraris}</a></li>
          </ul>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
            <Link href="/login" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none', lineHeight: '1' }}>{t.navLogin}</Link>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              {(['ca', 'es'] as const).map(l => (
                <button key={l} onClick={() => setLocale(l)} style={{
                  fontSize: 9, fontWeight: 700, padding: '4px 7px', cursor: 'pointer',
                  color: 'var(--text)', fontFamily: 'inherit', letterSpacing: '.04em', lineHeight: 1,
                  background: locale === l ? 'var(--surface)' : 'transparent',
                  border: 'none',
                }}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: '16px 16px 48px' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 24, maxWidth: 1340, margin: '0 auto', padding: '44px 32px 36px' }}>

          {/* Centered heading */}
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 40px' }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -.4, color: 'var(--accent)', marginBottom: 8 }}>Taula Systems</div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', marginBottom: 16 }}>{t.eyebrow}</div>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 14 }} className="hero-h1-v2">
              {locale === 'ca'
                ? <>Gestiona <em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>Reserves</em> i <em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>Horaris</em> Faaàcil!</>
                : <>Gestiona <em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>Reservas</em> y <em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>Horarios</em> ¡Faaàcil!</>}
            </h1>
            <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>{t.sub}</p>
            <a href="#contacte" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, padding: '11px 22px', borderRadius: 8, textDecoration: 'none' }}>{t.ctaHero}</a>
          </div>

          {/* Sincronitzat badge — above panels */}
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', padding: '4px 12px', borderRadius: 999 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'flow 1.6s infinite linear' }} />
              {t.sync}
            </span>
          </div>

          {/* Dual panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }} className="panels-wrap-v2">

            {/* Panel: Gantt/Horaris — macOS window */}
            <div id="horaris" style={{ borderRadius: 12, border: '1px solid #1C1C1E', overflow: 'hidden', flex: 1, boxShadow: '0 10px 36px rgba(0,0,0,.18)' }}>
              <div style={{ background: '#2C2C2E', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
                </div>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.45)', paddingRight: 36 }}>{t.panelHoraris}</div>
              </div>
              <div style={{ background: '#fff' }}>
                <GanttMockup locale={locale} />
              </div>
            </div>

            {/* Panel: Reserves — macOS window */}
            <div id="reserves" style={{ borderRadius: 12, border: '1px solid #1C1C1E', overflow: 'hidden', flex: 1, boxShadow: '0 10px 36px rgba(0,0,0,.18)' }}>
              <div style={{ background: '#2C2C2E', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
                </div>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.45)', paddingRight: 36 }}>
                  {locale === 'ca' ? 'Reserves · Dissabte 7 juny' : 'Reservas · Sábado 7 junio'}
                </div>
              </div>
              <div style={{ background: '#fff' }}>
                <ReservesMockup locale={locale} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section id="contacte" style={{ background: 'var(--text)', padding: '64px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: '#fff', marginBottom: 10 }} className="cta-h-v2">
          {locale === 'ca' ? <>Interessat? <em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>Parlem.</em></> : <>¿Interesado? <em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>Hablemos.</em></>}
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,.5)', marginBottom: 32 }}>{t.ctaP}</p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 40 }}>
          <a href="tel:+34620925416" style={{ fontSize: 28, fontWeight: 800, color: '#fff', textDecoration: 'none', letterSpacing: -.5 }}>+34 620 925 416</a>
          <a href="mailto:taulasystems@gmail.com" style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,.75)', textDecoration: 'none' }}>taulasystems@gmail.com</a>
          <a href="mailto:taulasystems@gmail.com" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 700, padding: '14px 32px', borderRadius: 9, textDecoration: 'none', marginTop: 8 }}>{t.ctaHero}</a>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.12)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          <a href="/" style={{ fontSize: 18, fontWeight: 800, letterSpacing: -.4, color: '#fff', textDecoration: 'none' }}>Taula<em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>.</em></a>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>© 2026 Taula Systems</span>
        </div>
      </section>


{/* ── Responsive + connector animation ── */}
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes flow { to { top: 100%; } }
        @media (min-width: 860px) {
          .hero-h1-v2 { font-size: 52px !important; }
          .cta-h-v2   { font-size: 40px !important; }
          .panels-wrap-v2 { flex-direction: row !important; align-items: flex-start !important; }
          .connector-v2   { flex-direction: row !important; padding: 0 4px !important; }
          .connector-v2 > div:first-child,
          .connector-v2 > div:last-child { width: 40px !important; height: 2px !important; }
        }
        @media (max-width: 520px) { .nav-links-v2 { display: none !important; } }
      `}</style>
    </div>
  )
}
