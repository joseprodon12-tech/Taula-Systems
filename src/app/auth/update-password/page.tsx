'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les contrasenyes no coincideixen.')
      return
    }
    if (password.length < 6) {
      setError('La contrasenya ha de tenir mínim 6 caràcters.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Error en actualitzar la contrasenya. Torna-ho a intentar.')
      setLoading(false)
    } else {
      router.push('/avui')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Taula</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Defineix la teva contrasenya</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              Nova contrasenya
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
              Confirma la contrasenya
            </label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="input"
            />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--state-noshow)' }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Guardant...' : 'Guardar contrasenya'}
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={async () => {
              await createClient().auth.signOut()
              router.push('/login')
            }}
          >
            Cancel·lar
          </button>
        </form>
      </div>
    </main>
  )
}
