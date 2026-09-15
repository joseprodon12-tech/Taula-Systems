'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

// El nom d'usuari es resol al servidor: get_email_by_username no és executable
// per anon, així ningú pot esbrinar correus des del navegador.
export async function signIn(identifier: string, password: string): Promise<{ error: string } | undefined> {
  let email = identifier.trim()

  if (!email.includes('@')) {
    const admin = await createServiceClient()
    const { data } = await admin.rpc('get_email_by_username', { p_username: email })
    // Mateix missatge que amb contrasenya incorrecta: no revelem quins usuaris existeixen
    if (!data) return { error: 'Credencials incorrectes.' }
    email = data as string
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Credencials incorrectes.' }
}
