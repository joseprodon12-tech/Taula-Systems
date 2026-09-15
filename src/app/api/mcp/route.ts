import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { getAuthRestaurant, runWithAccessToken } from '@/lib/auth'
import { registerReservationTools } from '@/lib/mcp/reserves'
import { registerTeamTools } from '@/lib/mcp/equip'
import { registerSettingsTools } from '@/lib/mcp/config'

// Connector MCP: les eines criden les mateixes server actions que el panell,
// executades com l'usuari del token OAuth (mateix restaurant, rol i RLS).

export const dynamic = 'force-dynamic'

async function handle(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  const authorized = token && await runWithAccessToken(token, getAuthRestaurant).then(() => true, () => false)

  if (!authorized) {
    // RFC 9728: indica al client MCP on descobrir com autenticar-se
    const metadata = `${new URL(request.url).origin}/.well-known/oauth-protected-resource`
    return Response.json(
      { error: 'No autoritzat' },
      { status: 401, headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadata}"` } }
    )
  }

  const server = new McpServer({ name: 'taula-systems', version: '1.0.0' })
  registerReservationTools(server)
  registerTeamTools(server)
  registerSettingsTools(server)

  // Sense sessions: cada petició és independent, que és el que encaixa amb serverless
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return runWithAccessToken(token, () => transport.handleRequest(request))
}

export { handle as GET, handle as POST, handle as DELETE }
