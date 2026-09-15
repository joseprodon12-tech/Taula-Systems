import { redirect } from 'next/navigation'
import { getAuthRestaurant } from '@/lib/auth'
import { decideAuthorization } from '@/app/actions/auth'

// Supabase Auth hi envia l'usuari quan un client OAuth (p. ex. Claude) demana
// accés. El proxy ja ha obligat a fer login abans d'arribar aquí.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>
}) {
  const { authorization_id: authorizationId } = await searchParams
  if (!authorizationId) return <Notice text="Falta la sol·licitud d'autorització." />

  const { supabase, restaurant } = await getAuthRestaurant()
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (error || !data) return <Notice text="Aquesta sol·licitud ja no és vàlida. Torna-ho a provar des de Claude." />

  // Ja s'havia donat permís abans: Supabase retorna directament on tornar
  if (!('authorization_id' in data)) redirect(data.redirect_url)

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', background: 'var(--surface)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <p className="panel-brand" style={{ marginBottom: 20 }}>Taula<span>.</span></p>
        <h1 style={{ fontSize: 20, fontWeight: 650, marginBottom: 8 }}>
          Connectar {data.client.name}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          {data.client.name} vol consultar les dades de <strong style={{ color: 'var(--text)' }}>{restaurant.name}</strong>:
        </p>
        <ul style={{ listStyle: 'disc', paddingLeft: 20, marginBottom: 16, lineHeight: 1.8 }}>
          <li>Reserves de cada dia</li>
          <li>Disponibilitat i horaris</li>
          <li>Torns de l&apos;equip</li>
        </ul>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          Només podrà llegir: no pot crear, modificar ni cancel·lar res. Sessió iniciada com a {data.user.email}.
        </p>
        <form action={decideAuthorization} style={{ display: 'flex', gap: 12 }}>
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <button type="submit" name="decision" value="deny" className="btn btn-secondary" style={{ flex: 1 }}>
            Denegar
          </button>
          <button type="submit" name="decision" value="approve" className="btn btn-primary" style={{ flex: 1 }}>
            Permetre
          </button>
        </form>
      </div>
    </main>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', background: 'var(--surface)' }}>
      <div className="card" style={{ maxWidth: 420 }}>{text}</div>
    </main>
  )
}
