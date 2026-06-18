export default function Loading() {
  return (
    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>

      <div style={{ width: 160, height: 28, borderRadius: 8, background: 'var(--border)', marginBottom: 24 }} />

      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ padding: 20, marginBottom: 16, height: 140 }} />
      ))}
    </div>
  )
}
