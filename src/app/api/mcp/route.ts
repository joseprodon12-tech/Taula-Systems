import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getAvailableSlots } from '@/lib/schedule'
import type { WeeklyHours } from '@/db/schema'

// Connector MCP de només lectura. El restaurant es deriva sempre de la
// credencial (clau fixa o sessió OAuth): mai d'un restaurant_id del client.

export const dynamic = 'force-dynamic'

const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe('Data en format YYYY-MM-DD. Si no s\'indica, avui.')

// El servidor de Vercel va en UTC; el restaurant viu a hora de Madrid
function todayMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

async function restaurantForRequest(request: Request, supabase: SupabaseClient): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null

  for (const pair of (process.env.MCP_TOKENS ?? '').split(',')) {
    const [t, restaurantId] = pair.trim().split(':')
    if (t && restaurantId && t === token) return restaurantId
  }

  // Token OAuth emès per Supabase Auth quan un usuari del panell autoritza el client
  // getClaims llança amb un token mal format: el tractem com a no autoritzat
  const { data } = await supabase.auth.getClaims(token).catch(() => ({ data: null }))
  if (!data) return null
  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', data.claims.sub)
    .maybeSingle()
  return member?.restaurant_id ?? null
}

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function buildServer(supabase: SupabaseClient, restaurantId: string) {
  const server = new McpServer({ name: 'taula-systems', version: '0.2.0' })

  server.registerTool('reserves_del_dia', {
    title: 'Reserves del dia',
    description: "Llista les reserves d'un dia: hora, persones, client, secció, taula, estat, notes i al·lèrgies.",
    inputSchema: { data: dateInput },
    annotations: { readOnlyHint: true },
  }, async ({ data }) => {
    const date = data ?? todayMadrid()
    const { data: reserves, error } = await supabase
      .from('reservations')
      .select('time, party_size, customer_name, customer_phone, section, table_number, status, notes, allergies, special_occasion')
      .eq('restaurant_id', restaurantId)
      .eq('date', date)
      .order('time')
    if (error) throw error
    return json({ data: date, reserves })
  })

  server.registerTool('disponibilitat', {
    title: 'Disponibilitat',
    description: "Diu si el restaurant obre un dia, les franges horàries reservables i quantes places hi ha ocupades per secció. La capacitat és orientativa: el propietari pot acceptar reserves per sobre.",
    inputSchema: { data: dateInput },
    annotations: { readOnlyHint: true },
  }, async ({ data }) => {
    const date = data ?? todayMadrid()
    const [{ data: restaurant, error }, { data: closure }, { data: booked }] = await Promise.all([
      supabase.from('restaurants').select('weekly_hours, capacity_indoor, capacity_outdoor').eq('id', restaurantId).single(),
      supabase.from('closures').select('reason').eq('restaurant_id', restaurantId).eq('date', date).maybeSingle(),
      supabase.from('reservations').select('party_size, section').eq('restaurant_id', restaurantId).eq('date', date).in('status', ['pending', 'arrived']),
    ])
    if (error) throw error
    if (closure) return json({ data: date, obert: false, motiu: closure.reason })

    const occupied = (section: string) =>
      (booked ?? []).filter(r => r.section === section).reduce((sum, r) => sum + r.party_size, 0)
    const franges = getAvailableSlots(restaurant.weekly_hours as WeeklyHours, date)
    return json({
      data: date,
      obert: franges.length > 0,
      franges,
      places: {
        interior: { capacitat: restaurant.capacity_indoor, ocupades: occupied('indoor') },
        terrassa: { capacitat: restaurant.capacity_outdoor, ocupades: occupied('outdoor') },
      },
    })
  })

  server.registerTool('equip_del_dia', {
    title: "Equip del dia",
    description: "Llista qui treballa un dia (torns amb horari i si estan publicats) i qui té absència.",
    inputSchema: { data: dateInput },
    annotations: { readOnlyHint: true },
  }, async ({ data }) => {
    const date = data ?? todayMadrid()
    const [{ data: torns, error }, { data: absencies, error: absError }] = await Promise.all([
      supabase
        .from('shifts')
        .select('start_time, end_time, zone, published, employee:employees!inner(name, role_label)')
        .eq('restaurant_id', restaurantId)
        .eq('date', date)
        .eq('employees.active', true)
        .order('start_time'),
      supabase
        .from('absences')
        .select('type, date_from, date_to, employee:employees!inner(name)')
        .eq('restaurant_id', restaurantId)
        .lte('date_from', date)
        .gte('date_to', date),
    ])
    if (error) throw error
    if (absError) throw absError
    return json({ data: date, torns, absencies })
  })

  return server
}

async function handle(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const restaurantId = await restaurantForRequest(request, supabase)
  if (!restaurantId) {
    // RFC 9728: indica al client MCP on descobrir com autenticar-se
    const metadata = `${new URL(request.url).origin}/.well-known/oauth-protected-resource`
    return Response.json(
      { error: 'No autoritzat' },
      { status: 401, headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadata}"` } }
    )
  }
  // Sense sessions: cada petició és independent, que és el que encaixa amb serverless
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await buildServer(supabase, restaurantId).connect(transport)
  return transport.handleRequest(request)
}

export { handle as GET, handle as POST, handle as DELETE }
