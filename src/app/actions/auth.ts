'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// El nom d'usuari es resol al servidor: get_email_by_username no és executable
// per anon ni authenticated, així ningú pot esbrinar correus des del navegador.
export async function signIn(identifier: string, password: string): Promise<{ error: string } | undefined> {
  let email = identifier.trim()

  if (!email.includes('@')) {
    // Sense cookies: si n'hi hagués una sessió oberta, supabase-ssr enviaria
    // el JWT de l'usuari en lloc del service role i la crida rebria un 403
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data } = await admin.rpc('get_email_by_username', { p_username: email })
    // Mateix missatge que amb contrasenya incorrecta: no revelem quins usuaris existeixen
    if (!data) return { error: 'Credencials incorrectes.' }
    email = data as string
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Credencials incorrectes.' }
}
