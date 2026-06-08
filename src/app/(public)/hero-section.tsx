'use client'

import ReservesMockup from './reserves-mockup'

type Locale = 'ca' | 'es'

const T = {
  ca: {
    pill:     'Widget de reserves al teu web',
    h1a:      'Les teves reserves,',
    h1b:      'sense ',          // "sense " + rotating word
    rotating: ['paper', 'trucades', 'caos'] as const,
    sub:      'Per a restaurants familiars.\nSense comissions, sense complexitat.',
    cta1:     'Prova-ho gratis →',
    cta2:     'Veure la demo',
    anti:     ['Sense contracte', 'Sense comissions', 'Sense targeta'],
    r1:       '4.9 Trustpilot',
    r2:       '+120 restaurants',
  },
  es: {
    pill:     'Widget de reservas en tu web',
    h1a:      'Tus reservas,',
    h1b:      'sin ',
    rotating: ['papel', 'llamadas', 'caos'] as const,
    sub:      'Para restaurantes familiares.\nSin comisiones, sin complejidad.',
    cta1:     'Pruébalo gratis →',
    cta2:     'Ver la demo',
    anti:     ['Sin contrato', 'Sin comisiones', 'Sin tarjeta'],
    r1:       '4.9 Trustpilot',
    r2:       '+120 restaurantes',
  },
}

export default function HeroSection({ locale }: { locale: Locale }) {
  const t = T[locale]

  return (
    <section style={{ padding: '20px 16px 36px' }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 24,
        maxWidth: 1140, margin: '0 auto', padding: '44px 28px 36px', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 40,
        }} className="hero-grid">

          {/* ── Text left ── */}
          <div className="hero-text" style={{ flex: '0 0 440px' }}>

            {/* Pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 999, padding: '5px 12px 5px 6px',
              fontSize: 12, fontWeight: 500, color: '#1A1A18',
              marginBottom: 22, cursor: 'default',
            }}>
              <span style={{
                background: 'var(--accent)', color: '#fff',
                fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em',
                padding: '2px 6px', borderRadius: 4,
              }}>Nou</span>
              {t.pill}
              <span style={{ color: 'var(--muted)' }}>›</span>
            </div>

            {/* H1 */}
            <h1 style={{
              fontSize: 42, fontWeight: 800, letterSpacing: -2,
              lineHeight: 1.08, color: '#1A1A18', marginBottom: 18,
            }} className="hero-h1">
              {t.h1a}<br />
              {t.h1b}
              {/* Rotating words */}
              <span aria-label={t.rotating.join(', ')} style={{
                display: 'inline-block', position: 'relative', verticalAlign: 'bottom',
                minWidth: 190, height: '1.08em', overflow: 'hidden',
              }}>
                {t.rotating.map((w, i) => (
                  <span key={w} style={{
                    position: 'absolute', bottom: 0, left: 0,
                    color: 'var(--accent)', opacity: 0, whiteSpace: 'nowrap',
                    animation: 'rword 12s infinite',
                    animationDelay: `${i * 4}s`,
                  }}>{w}</span>
                ))}
              </span>
            </h1>

            <p style={{ fontSize: 17, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 400, marginBottom: 28, whiteSpace: 'pre-line' }}>
              {t.sub}
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }} className="hero-ctas">
              <a href="mailto:hola@taula.cat" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'var(--accent)', color: '#fff',
                fontSize: 16, fontWeight: 600, padding: '14px 26px', borderRadius: 8,
                textDecoration: 'none', whiteSpace: 'nowrap',
              }}>{t.cta1}</a>
              <a href="mailto:hola@taula.cat" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'transparent', color: '#1A1A18',
                fontSize: 16, fontWeight: 500, padding: '14px 26px', borderRadius: 8,
                border: '1.5px solid var(--border)', textDecoration: 'none', whiteSpace: 'nowrap',
              }}>{t.cta2}</a>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {t.anti.map((s, i) => (
                <span key={s}>
                  {i > 0 && <span style={{ opacity: .5, marginRight: 6 }}>·</span>}
                  {s}
                </span>
              ))}
            </div>

            {/* Ratings */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 24 }}>
              {[t.r1, t.r2].map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                  <span style={{ color: '#F59E0B', letterSpacing: 1, fontSize: 11 }}>★★★★★</span>
                  {r}
                </div>
              ))}
            </div>
          </div>

          {/* ── Product mockup right ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <ReservesMockup />
          </div>

        </div>
      </div>

      <style>{`
        @media (min-width: 920px) {
          .hero-grid { flex-direction: row !important; align-items: center !important; gap: 56px !important; }
          .hero-h1   { font-size: 62px !important; }
          .hero-ctas { flex-direction: row !important; }
          .hero-text span[aria-label] { min-width: 270px !important; }
        }
        @media (min-width: 920px) {
          .hero-text { padding-right: 0; }
        }
      `}</style>
    </section>
  )
}
