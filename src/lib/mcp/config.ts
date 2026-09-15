import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  getRestaurant, saveRestaurantInfo, saveWeeklyHours, saveCapacity, saveDurations,
  saveNotificationConfig, getClosures, addClosure, removeClosure,
} from '@/app/actions/config'
import { getTables, createTable, updateTable, deleteTable } from '@/app/actions/tables'
import { date, time, id, reply } from './shared'

// weekly_hours fa servir la numeració de Date.getDay(): 0 = diumenge
const DAYS = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'] as const
const service = z.object({ inici: time, fi: time }).nullable().optional()
  .describe("Franja reservable; null per treure aquest servei, sense indicar-ho per deixar-lo com està")
const section = z.enum(['indoor', 'outdoor']).describe('indoor = interior, outdoor = terrassa')

export function registerSettingsTools(server: McpServer) {
  server.registerTool('configuracio_restaurant', {
    title: 'Configuració del restaurant',
    description: "Dades del restaurant, horari setmanal, capacitat, durades per defecte, canal de notificacions, taules i dies tancats.",
    annotations: { readOnlyHint: true },
  }, async () => {
    const { restaurant, role } = await getRestaurant()
    const [taules, dies_tancats] = await Promise.all([getTables(), getClosures(restaurant.id)])
    return reply({
      el_teu_rol: role,
      nom: restaurant.name,
      telefon: restaurant.phone,
      email: restaurant.email,
      adreca: restaurant.address,
      ciutat: restaurant.city,
      enllac_reserves: `https://taulaapp.com/r/${restaurant.slug}`,
      missatge_benvinguda: restaurant.welcome_message,
      whatsapp_propietari: restaurant.whatsapp_number,
      horari: Object.fromEntries(DAYS.map((d, i) => [d, restaurant.weekly_hours[String(i)] ?? { closed: true }])),
      capacitat: { interior: restaurant.capacity_indoor, terrassa: restaurant.capacity_outdoor },
      durada_minuts: { dinar: restaurant.default_duration_lunch_min, sopar: restaurant.default_duration_dinner_min },
      notificacions: { canal: restaurant.notification_channel, remitent_email: restaurant.notification_email_from },
      taules,
      dies_tancats,
    })
  })

  server.registerTool('guardar_dades_restaurant', {
    title: 'Guardar dades del restaurant',
    description: "Canvia nom, telèfon, email, adreça, missatge de benvinguda del formulari públic o WhatsApp del propietari. Només cal passar els camps que canvien. Només el propietari.",
    inputSchema: {
      nom: z.string().min(1).optional(),
      telefon: z.string().optional(),
      email: z.string().optional(),
      adreca: z.string().optional(),
      ciutat: z.string().optional(),
      missatge_benvinguda: z.string().optional(),
      whatsapp_propietari: z.string().optional().describe('Número on arriben els avisos de reserves noves online'),
      slug: z.string().regex(/^[a-z0-9-]+$/).optional()
        .describe("Part final de l'enllaç públic de reserves. ATENCIÓ: canviar-lo trenca l'enllaç que ja tinguin els clients"),
    },
  }, async (a) => {
    const { restaurant: r } = await getRestaurant()
    return reply(await saveRestaurantInfo(r.id, {
      name: a.nom ?? r.name,
      phone: a.telefon ?? r.phone ?? '',
      email: a.email ?? r.email ?? '',
      address: a.adreca ?? r.address ?? '',
      city: a.ciutat ?? r.city ?? '',
      slug: a.slug ?? r.slug,
      welcome_message: a.missatge_benvinguda ?? r.welcome_message ?? '',
      whatsapp_number: a.whatsapp_propietari ?? r.whatsapp_number ?? '',
    }))
  })

  server.registerTool('guardar_horari_dia', {
    title: "Guardar l'horari d'un dia",
    description: "Canvia l'horari habitual d'un dia de la setmana (obert/tancat i franges de dinar i sopar). Per tancar un dia concret del calendari fes servir afegir_dia_tancat. Només el propietari.",
    inputSchema: {
      dia: z.enum(DAYS),
      tancat: z.boolean().describe('true si el restaurant tanca aquest dia de la setmana'),
      dinar: service,
      sopar: service,
    },
  }, async ({ dia, tancat, dinar, sopar }) => {
    const { restaurant: r } = await getRestaurant()
    const key = String(DAYS.indexOf(dia))
    const current = r.weekly_hours[key] ?? {}
    const lunch = dinar === undefined ? current.lunch : dinar ? [dinar.inici, dinar.fi] as [string, string] : undefined
    const dinner = sopar === undefined ? current.dinner : sopar ? [sopar.inici, sopar.fi] as [string, string] : undefined
    const day = tancat ? { closed: true } : { ...(lunch ? { lunch } : {}), ...(dinner ? { dinner } : {}) }
    return reply(await saveWeeklyHours(r.id, { ...r.weekly_hours, [key]: day }))
  })

  server.registerTool('guardar_capacitat', {
    title: 'Guardar capacitat',
    description: "Canvia les places totals d'interior i/o terrassa (serveix per avisar quan es superen). Només el propietari.",
    inputSchema: { interior: z.number().int().min(0).optional(), terrassa: z.number().int().min(0).optional() },
  }, async ({ interior, terrassa }) => {
    const { restaurant: r } = await getRestaurant()
    return reply(await saveCapacity(r.id, interior ?? r.capacity_indoor, terrassa ?? r.capacity_outdoor))
  })

  server.registerTool('guardar_durades', {
    title: 'Guardar durades per defecte',
    description: 'Canvia quants minuts dura per defecte una reserva de dinar i/o de sopar. Només el propietari.',
    inputSchema: { dinar_minuts: z.number().int().min(15).optional(), sopar_minuts: z.number().int().min(15).optional() },
  }, async ({ dinar_minuts, sopar_minuts }) => {
    const { restaurant: r } = await getRestaurant()
    return reply(await saveDurations(r.id, dinar_minuts ?? r.default_duration_lunch_min, sopar_minuts ?? r.default_duration_dinner_min))
  })

  server.registerTool('guardar_notificacions', {
    title: 'Guardar canal de notificacions',
    description: "Tria com reben els clients la confirmació i el recordatori de la reserva: 'none' (cap), 'email' o 'whatsapp'. ATENCIÓ: amb email o whatsapp els clients reals rebran missatges; confirma-ho sempre abans amb l'usuari. Només el propietari.",
    inputSchema: {
      canal: z.enum(['none', 'email', 'whatsapp']),
      remitent_email: z.string().optional().describe("Adreça remitent quan el canal és email"),
    },
    annotations: { destructiveHint: true },
  }, async ({ canal, remitent_email }) => {
    const { restaurant: r } = await getRestaurant()
    return reply(await saveNotificationConfig(r.id, {
      notification_channel: canal,
      notification_email_from: remitent_email ?? r.notification_email_from ?? '',
    }))
  })

  server.registerTool('afegir_dia_tancat', {
    title: 'Afegir dia tancat',
    description: "Tanca el restaurant un dia concret (vacances, festiu...). Aquell dia no s'hi podran fer reserves noves; les que ja hi ha NO es cancel·len. Si hi ha reserves actives, la crida no tanca el dia i retorna needsConfirmation amb quantes n'hi ha (reservations): explica-ho a l'usuari i, només si hi està d'acord, torna a cridar amb confirmar: true. Només el propietari.",
    inputSchema: {
      data: date,
      motiu: z.string().optional(),
      confirmar: z.boolean().optional().describe("true només quan l'usuari ja ha acceptat tancar un dia que té reserves"),
    },
  }, async ({ data, motiu, confirmar }) => reply(await addClosure(data, motiu ?? '', confirmar ?? false)))

  server.registerTool('treure_dia_tancat', {
    title: 'Treure dia tancat',
    description: "Torna a obrir un dia que estava marcat com a tancat (l'id surt a configuracio_restaurant). Només el propietari.",
    inputSchema: { id },
    annotations: { destructiveHint: true },
  }, async ({ id }) => reply(await removeClosure(id)))

  server.registerTool('crear_taula', {
    title: 'Crear taula',
    description: 'Afegeix una taula. Només el propietari.',
    inputSchema: { numero: z.string().min(1), seccio: section, places: z.number().int().min(1) },
  }, async ({ numero, seccio, places }) => reply(await createTable({ number: numero, section: seccio, capacity: places })))

  server.registerTool('modificar_taula', {
    title: 'Modificar taula',
    description: "Canvia el número, la secció o les places d'una taula (l'id surt a configuracio_restaurant). Només el propietari.",
    inputSchema: { id, numero: z.string().min(1).optional(), seccio: section.optional(), places: z.number().int().min(1).optional() },
  }, async (a) => {
    const current = (await getTables()).find(t => t.id === a.id)
    if (!current) return reply({ error: 'Taula no trobada' })
    return reply(await updateTable(a.id, {
      number: a.numero ?? current.number,
      section: a.seccio ?? current.section,
      capacity: a.places ?? current.capacity,
    }))
  })

  server.registerTool('eliminar_taula', {
    title: 'Eliminar taula',
    description: "Esborra una taula. No es pot si té reserves futures. Confirma-ho abans amb l'usuari. Només el propietari.",
    inputSchema: { id },
    annotations: { destructiveHint: true },
  }, async ({ id }) => reply(await deleteTable(id)))
}
