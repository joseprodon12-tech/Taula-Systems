export default function Loading() {
  return (
    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>

      {/* Capçalera setmana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--border)' }} />
        <div style={{ width: 160, height: 28, borderRadius: 8, background: 'var(--border)' }} />
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--border)' }} />
      </div>

      {/* Dies de la setmana */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} style={{ flex: 1, height: 56, borderRadius: 8, background: 'var(--border)' }} />
        ))}
      </div>

      {/* Reserves */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ padding: 16, height: 80 }} />
        ))}
      </div>
    </div>
  )
}
