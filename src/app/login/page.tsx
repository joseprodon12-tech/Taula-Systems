'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError('Error en enviar el correu. Torna-ho a intentar.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Taula</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Accedeix al teu panell</p>
        </div>

        {sent ? (
          <div className="card p-6 text-center">
            <div className="text-3xl mb-3">📬</div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>Revisa el correu</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              T&apos;hem enviat un enllaç d&apos;accés a <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                Correu electrònic
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@restaurant.cat"
                className="input"
              />
            </div>
            {error && <p className="text-sm" style={{ color: 'var(--state-noshow)' }}>{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Enviant...' : 'Continuar'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
