import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { getAuthRestaurant, runWithAccessToken } from '@/lib/auth'
import { registerReservationTools } from '@/lib/mcp/reserves'
import { registerTeamTools } from '@/lib/mcp/equip'
import { registerSettingsTools } from '@/lib/mcp/config'
import { registerSuggestionTools } from '@/lib/mcp/suggeriments'

// Connector MCP: les eines criden les mateixes server actions que el panell,
// executades com l'usuari del token OAuth (mateix restaurant, rol i RLS).

export const dynamic = 'force-dynamic'

// Context que el client MCP dona al model sobre com fer servir aquest servidor
const INSTRUCTIONS = [
  "Taula és l'aplicació amb què el restaurant gestiona reserves, equip i configuració. Actues en nom de l'usuari connectat, amb els seus mateixos permisos.",
  "Abans de cancel·lar, eliminar, desactivar o canviar el canal de notificacions, confirma-ho amb l'usuari.",
  "Quan l'usuari vulgui proposar un canvi, explicar un error o compartir una idea sobre l'aplicació (p. ex. \"vull enviar un suggeriment\"), segueix les indicacions de l'eina enviar_suggeriment. Per saber com van, fes servir els_meus_suggeriments.",
].join('\n')

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

  const server = new McpServer({ name: 'taula-systems', version: '1.1.0' }, { instructions: INSTRUCTIONS })
  registerReservationTools(server)
  registerTeamTools(server)
  registerSettingsTools(server)
  registerSuggestionTools(server)

  // Sense sessions: cada petició és independent, que és el que encaixa amb serverless
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return runWithAccessToken(token, () => transport.handleRequest(request))
}

export { handle as GET, handle as POST, handle as DELETE }
