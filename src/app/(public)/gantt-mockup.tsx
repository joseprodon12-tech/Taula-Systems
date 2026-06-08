type Locale = 'ca' | 'es'

const LABELS = {
  ca: { t1: 'Taula 1', t2: 'Taula 2', terrassa: 'Terrassa', bar: 'Bar', servei: 'Servei continu', llegenda: 'Llegenda:', pendent: 'Pendent', confirmat: 'Confirmat', vingut: 'Ha vingut', ara: '│ Ara' },
  es: { t1: 'Mesa 1',  t2: 'Mesa 2',  terrassa: 'Terraza',  bar: 'Bar', servei: 'Servicio continuo', llegenda: 'Leyenda:', pendent: 'Pendiente', confirmat: 'Confirmado', vingut: 'Ha venido', ara: '│ Ahora' },
}

const HOURS = ['13h','14h','15h','16h','20h','21h','22h']

const ROWS: { key: keyof typeof LABELS.ca; blocks: { left: number; w: number; cls: string; label: string }[] }[] = [
  { key: 't1',       blocks: [{ left: 0,   w: 28, cls: 'gb-1', label: 'Bosch'     }, { left: 71, w: 22, cls: 'gb-2', label: 'Vidal'   }] },
  { key: 't2',       blocks: [{ left: 14,  w: 19, cls: 'gb-3', label: 'Puig'      }, { left: 57, w: 28, cls: 'gb-1', label: 'Can Roca' }] },
  { key: 'terrassa', blocks: [{ left: 28,  w: 24, cls: 'gb-4', label: 'Grup Of.'  }, { left: 71, w: 18, cls: 'gb-2', label: '—'       }] },
  { key: 'bar',      blocks: [{ left: 0,   w: 42, cls: 'gb-2', label: ''          }] },
]

const GB: Record<string, { background: string; color: string }> = {
  'gb-1': { background: '#FAE8E4', color: '#A83923' },
  'gb-2': { background: '#D1FAE5', color: '#065F46' },
  'gb-3': { background: '#EDE9FE', color: '#5B21B6' },
  'gb-4': { background: '#FEF3C7', color: '#92400E' },
}

const NOW_LEFT = 14

export default function GanttMockup({ locale = 'ca' }: { locale?: Locale }) {
  const l = LABELS[locale]

  return (
    <div style={{ padding: 16, overflowX: 'auto' }}>
      {/* Hour header */}
      <div style={{ display: 'flex', marginBottom: 8, marginLeft: 96 }}>
        {HOURS.map(h => (
          <div key={h} style={{ flex: 1, fontSize: 12, color: 'var(--muted)', fontWeight: 600, textAlign: 'center' }}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {ROWS.map(row => (
        <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', width: 90, flexShrink: 0, textAlign: 'right', paddingRight: 10 }}>
            {row.key === 'bar' ? l.bar : l[row.key as keyof typeof l]}
          </div>
          <div style={{ flex: 1, height: 34, background: 'var(--bg)', borderRadius: 6, position: 'relative', border: '1px solid var(--border)' }}>
            {row.blocks.map((b, i) => (
              <div key={i} style={{
                position: 'absolute', left: `${b.left}%`, width: `${b.w}%`,
                top: 3, height: 28, borderRadius: 4,
                display: 'flex', alignItems: 'center', padding: '0 8px',
                fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden',
                ...GB[b.cls],
              }}>
                {b.label === '' ? l.servei : b.label}
              </div>
            ))}
            {/* Now line */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${NOW_LEFT}%`, width: 2, background: 'var(--accent)', opacity: .6, pointerEvents: 'none' }} />
          </div>
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{l.llegenda}</span>
        {[
          { background: '#FAE8E4', color: '#A83923', label: l.pendent   },
          { background: '#D1FAE5', color: '#065F46', label: l.confirmat },
          { background: '#EDE9FE', color: '#5B21B6', label: l.vingut    },
        ].map(s => (
          <span key={s.label} style={{ fontSize: 12, background: s.background, color: s.color, padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>{s.label}</span>
        ))}
        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{l.ara}</span>
      </div>
    </div>
  )
}
