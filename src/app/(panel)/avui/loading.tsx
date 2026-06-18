export default function Loading() {
  return (
    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>

      {/* Capçalera data */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--border)' }} />
        <div style={{ width: 200, height: 28, borderRadius: 8, background: 'var(--border)' }} />
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--border)' }} />
      </div>

      {/* Dues targetes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ padding: 20, height: 220 }} />
        <div className="card" style={{ padding: 20, height: 220 }} />
      </div>

      {/* Barra de notificacions */}
      <div className="card" style={{ padding: 0, marginBottom: 20, height: 44 }} />

      {/* Reserves */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ padding: 16, height: 96 }} />
        ))}
      </div>
    </div>
  )
}
