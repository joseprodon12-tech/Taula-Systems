import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createSuggestion, getSuggestions } from '@/app/actions/suggestions'
import { reply } from './shared'

export function registerSuggestionTools(server: McpServer) {
  server.registerTool('enviar_suggeriment', {
    title: 'Enviar suggeriment sobre Taula',
    description: [
      "Envia a l'equip de Taula un error, una millora o una idea sobre l'aplicació. L'equip els revisa i decideix què s'implementa.",
      'Com fer-ho:',
      "1. Escolta el que explica l'usuari. Si en diu diverses coses, envia un suggeriment per a cadascuna.",
      '2. Si falta informació, pregunta-la amb poques preguntes i en llenguatge planer: què vol exactament, per què li cal (quin problema té avui), a quina part de l\'app passa i si té un exemple real. No inventis res que no hagi dit.',
      "3. Si és un error, demana què estava fent, què esperava que passés i què va passar.",
      "4. Mostra-li el suggeriment resumit tal com l'enviaràs i demana-li confirmació.",
      "5. Envia'l i digues-li que l'equip l'ha rebut i que pot preguntar com va amb els_meus_suggeriments.",
    ].join('\n'),
    inputSchema: {
      titol: z.string().min(1).describe("Frase curta que resumeixi el canvi, p. ex. \"Marcar reserves d'aniversari\""),
      que: z.string().min(1).describe("Què vol que canviï o què falla, amb prou detall per entendre-ho sense haver sentit la conversa"),
      perque: z.string().min(1).describe('Per què li cal: quin problema té avui o què hi guanyaria'),
      on: z.enum(['avui', 'agenda', 'reserves', 'equip', 'configuracio', 'formulari_public', 'notificacions', 'connector_ia', 'altres'])
        .describe("Part de l'app: avui (pantalla d'inici), agenda, reserves (crear/editar), equip (torns i empleats), configuracio, formulari_public (on reserven els clients), notificacions (missatges als clients), connector_ia (fer servir Taula des de Claude), altres"),
      tipus: z.enum(['error', 'millora', 'idea'])
        .describe("error: alguna cosa no funciona com hauria; millora: una cosa que ja existeix podria anar millor; idea: una funcionalitat nova"),
      urgencia: z.enum(['baixa', 'normal', 'alta']).default('normal')
        .describe("alta només si li impedeix treballar amb normalitat"),
      exemple: z.string().optional().describe("Cas real concret, p. ex. \"Dissabte els Vila celebraven 50 anys i no ho vaig poder anotar\""),
    },
  }, async (a) => reply(await createSuggestion({
    title: a.titol, what: a.que, why: a.perque, area: a.on, kind: a.tipus, urgency: a.urgencia, example: a.exemple,
  })))

  server.registerTool('els_meus_suggeriments', {
    title: 'Estat dels suggeriments',
    description: "Llista els suggeriments enviats pel restaurant amb el seu estat (nou, acceptat, fet o descartat) i la resposta de l'equip de Taula, del més nou al més antic.",
    annotations: { readOnlyHint: true },
  }, async () => reply((await getSuggestions()).map(s => ({
    titol: s.title, tipus: s.kind, on: s.area, estat: s.status, resposta: s.response, enviat: s.created_at.slice(0, 10),
  }))))
}
