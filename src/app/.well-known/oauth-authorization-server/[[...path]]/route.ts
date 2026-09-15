// Alguns clients MCP busquen la configuració OAuth al domini del recurs en lloc
// de seguir authorization_servers: els retornem la de Supabase Auth tal qual.
export async function GET() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/.well-known/oauth-authorization-server/auth/v1`,
    { cache: 'no-store' }
  )
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } })
}
