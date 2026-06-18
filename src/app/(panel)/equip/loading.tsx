export default function Loading() {
  return (
    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--border)' }} />
        <div style={{ width: 180, height: 28, borderRadius: 8, background: 'var(--border)' }} />
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--border)' }} />
      </div>

      <div className="card" style={{ padding: 20, height: 280 }} />
    </div>
  )
}
