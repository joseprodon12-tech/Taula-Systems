'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')  // username o email
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    let email = identifier.trim()

    // Si no conté '@', és un username → buscar l'email via RPC
    if (!email.includes('@')) {
      const { data, error: rpcError } = await supabase
        .rpc('get_email_by_username', { p_username: email })
      if (rpcError || !data) {
        setError('Usuari no trobat.')
        setLoading(false)
        return
      }
      email = data as string
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Credencials incorrectes.')
      setLoading(false)
    } else {
      router.push('/avui')
    }
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FAFAF9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -.6, color: '#1A1A18' }}>
            Taula<em style={{ fontStyle: 'normal', color: '#C4472A' }}>.</em>
          </div>
          <div style={{ fontSize: 13, color: '#6B6560', marginTop: 6 }}>Panell de gestió</div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', border: '1px solid #E5DDD5', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
          <form onSubmit={handleSubmit}>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="identifier" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1A18', marginBottom: 6 }}>
                Usuari
              </label>
              <input
                id="identifier"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="nom d'usuari o correu"
                style={{
                  display: 'block', width: '100%', boxSizing: 'border-box',
                  fontSize: 14, padding: '10px 12px', color: '#1A1A18',
                  border: '1px solid #E5DDD5', borderRadius: 8, outline: 'none',
                  background: '#FAFAF9',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1A18', marginBottom: 6 }}>
                Contrasenya
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  display: 'block', width: '100%', boxSizing: 'border-box',
                  fontSize: 14, padding: '10px 12px', color: '#1A1A18',
                  border: '1px solid #E5DDD5', borderRadius: 8, outline: 'none',
                  background: '#FAFAF9',
                }}
              />
              <div style={{ textAlign: 'right', marginTop: 6 }}>
                <Link href="/auth/reset" style={{ fontSize: 13, color: '#6B6560', textDecoration: 'none' }}>
                  He oblidat la contrasenya?
                </Link>
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 13, color: '#C4472A', background: '#FAE8E4', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'block', width: '100%', padding: '12px',
                background: loading ? '#E5DDD5' : '#C4472A',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {loading ? 'Entrant...' : 'Entrar'}
            </button>

          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#B0A9A4' }}>
          © 2026 Taula Systems
        </div>
      </div>
    </main>
  )
}
