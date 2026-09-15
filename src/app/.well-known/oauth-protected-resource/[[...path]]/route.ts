// RFC 9728: indica als clients MCP que /api/mcp s'autentica amb Supabase Auth.
// El catch-all cobreix també la variant amb sufix (/.well-known/oauth-protected-resource/api/mcp).
export function GET(request: Request) {
  const origin = new URL(request.url).origin
  return Response.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
    bearer_methods_supported: ['header'],
  })
}
