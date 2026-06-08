type Locale = 'ca' | 'es'

const T = {
  ca: {
    h:    'Comença avui.\nÉs gratis.',
    sub:  'Configurat en menys de 10 minuts. Sense formació, sense trucades, sense cua.',
    cta:  'Prova-ho gratis →',
    g:    ['Sense contracte', 'Sense comissions', 'Sense targeta de crèdit'],
    fLinks: [
      { label: 'Producte', href: '#features' },
      { label: 'Privacitat', href: '#' },
      { label: "Termes d'ús", href: '#' },
      { label: 'Inicia sessió', href: '/login' },
      { label: 'hola@taula.cat', href: 'mailto:hola@taula.cat' },
    ],
  },
  es: {
    h:    'Empieza hoy.\nEs gratis.',
    sub:  'Configurado en menos de 10 minutos. Sin formación, sin llamadas, sin espera.',
    cta:  'Pruébalo gratis →',
    g:    ['Sin contrato', 'Sin comisiones', 'Sin tarjeta de crédito'],
    fLinks: [
      { label: 'Producto', href: '#features' },
      { label: 'Privacidad', href: '#' },
      { label: 'Términos de uso', href: '#' },
      { label: 'Iniciar sesión', href: '/login' },
      { label: 'hola@taula.cat', href: 'mailto:hola@taula.cat' },
    ],
  },
}

export default function CtaSection({ locale }: { locale: Locale }) {
  const t = T[locale]

  return (
    <>
      {/* ── CTA final ── */}
      <section style={{
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        padding: '80px 20px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <h2 style={{
            fontSize: 36, fontWeight: 900, letterSpacing: -1.5,
            lineHeight: 1.1, marginBottom: 12, whiteSpace: 'pre-line',
          }} className="cta-h2">{t.h}</h2>

          <p style={{ fontSize: 17, color: 'var(--muted)', marginBottom: 32, lineHeight: 1.5 }}>{t.sub}</p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <a href="mailto:hola@taula.cat" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--accent)', color: '#fff',
              fontSize: 17, fontWeight: 700, padding: '16px 36px', borderRadius: 10,
              textDecoration: 'none',
            }}>{t.cta}</a>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
              {t.g.map((g, i) => (
                <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {i > 0 && <span style={{ color: 'var(--border)' }}>·</span>}
                  ✓ {g}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 20px' }}>
        <div style={{
          maxWidth: 1140, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: 14,
        }} className="footer-inner">
          <a href="/" style={{ fontSize: 15, fontWeight: 800, letterSpacing: -.3, color: '#1A1A18', textDecoration: 'none' }}>
            Taula<em style={{ fontStyle: 'normal', color: 'var(--accent)' }}>.</em>
          </a>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {t.fLinks.map(l => (
              <a key={l.label} href={l.href} style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none' }}>
                {l.label}
              </a>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#B0A9A4' }}>© 2026 Taula Systems</div>
        </div>
      </footer>

      <style>{`
        @media (min-width: 600px)  { .cta-h2 { font-size: 52px !important; } }
        @media (min-width: 700px)  { .footer-inner { flex-direction: row !important; align-items: center !important; justify-content: space-between !important; } }
      `}</style>
    </>
  )
}
