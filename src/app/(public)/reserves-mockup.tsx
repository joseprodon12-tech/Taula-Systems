type Locale = 'ca' | 'es'

const L = {
  ca: {
    title: 'Reserves · Dissabte 7 juny',
    kpir: 'reserves', kpip: 'persones', kpipend: 'pendents',
    dinar: 'Dinar', sopar: 'Sopar',
    terrassa: 'Terrassa', interior: 'Interior',
    vingut: 'Ha vingut', pendent: 'Pendent', noshow: 'No-show',
  },
  es: {
    title: 'Reservas · Sábado 7 junio',
    kpir: 'reservas', kpip: 'personas', kpipend: 'pendientes',
    dinar: 'Almuerzo', sopar: 'Cena',
    terrassa: 'Terraza', interior: 'Interior',
    vingut: 'Ha venido', pendent: 'Pendiente', noshow: 'No-show',
  },
}

const BADGE: Record<string, { bg: string; color: string }> = {
  vingut:  { bg: '#D1FAE5', color: '#065F46' },
  pendent: { bg: '#F1F5F9', color: '#475569' },
  noshow:  { bg: '#FEE2E2', color: '#991B1B' },
}

export default function ReservesMockup({ locale = 'ca' }: { locale?: Locale }) {
  const l = L[locale]

  const rows = {
    dinar: [
      { time: '13:00', name: 'Família Bosch', pax: `6 p. · ${l.terrassa}`, badge: 'vingut'  },
      { time: '13:30', name: 'Martí Puig',    pax: `2 p. · ${l.interior}`, badge: 'vingut'  },
      { time: '14:00', name: 'Grup Oficina',  pax: `8 p. · ${l.interior}`, badge: 'pendent' },
    ],
    sopar: [
      { time: '20:30', name: 'Marta Vidal', pax: `4 p. · ${l.interior}`,  badge: 'pendent' },
      { time: '21:00', name: 'Can Roca',    pax: `10 p. · ${l.terrassa}`, badge: 'noshow'  },
    ],
  }

  return (
    <div>
      <div style={{ padding: 14 }}>
        {/* KPIs */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
          {[
            { v: '24', label: l.kpir,    red: false },
            { v: '86', label: l.kpip,    red: false },
            { v: '2',  label: l.kpipend, red: true  },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: k.red ? 'var(--accent)' : 'var(--text)' }}>{k.v}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Sections */}
        {([['dinar', rows.dinar], ['sopar', rows.sopar]] as const).map(([sec, list]) => (
          <div key={sec}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#B0A9A4', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, marginTop: 10 }}>
              {sec === 'dinar' ? l.dinar : l.sopar}
              <span style={{ flex: 1, height: 1, background: 'var(--border)', display: 'inline-block' }} />
            </div>
            {list.map(r => {
              const b = BADGE[r.badge]
              return (
                <div key={r.time} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, minWidth: 44 }}>{r.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.pax}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', background: b.bg, color: b.color }}>{l[r.badge as keyof typeof l]}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
