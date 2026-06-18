'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 15, color: 'var(--text)', marginBottom: 8 }}>No s'han pogut carregar les reserves.</p>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Comprova la connexió i torna-ho a intentar.</p>
      <button className="btn btn-primary" onClick={reset}>Reintentar</button>
    </div>
  )
}
