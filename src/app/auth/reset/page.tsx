'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading]       = useState(false)
  const [sent, setSent]             = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    let email = identifier.trim()

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

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/update-password`,
    })

    if (resetError) {
      setError('Error en enviar el correu. Torna-ho a intentar.')
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#FAFAF9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -.6, color: '#1A1A18' }}>
            Taula<em style={{ fontStyle: 'normal', color: '#C4472A' }}>.</em>
          </div>
          <div style={{ fontSize: 13, color: '#6B6560', marginTop: 6 }}>Recuperar contrasenya</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E5DDD5', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,.06)' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', marginBottom: 8 }}>
                Correu enviat
              </p>
              <p style={{ fontSize: 13, color: '#6B6560', lineHeight: 1.6 }}>
                T&apos;hem enviat un email amb l&apos;enllaç per recuperar la contrasenya.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 24 }}>
                <label htmlFor="identifier" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1A1A18', marginBottom: 6 }}>
                  Usuari o correu
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
                {loading ? 'Enviant...' : 'Enviar enllaç'}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link href="/login" style={{ fontSize: 13, color: '#6B6560', textDecoration: 'none' }}>
            ← Tornar al login
          </Link>
        </div>
      </div>
    </main>
  )
}
