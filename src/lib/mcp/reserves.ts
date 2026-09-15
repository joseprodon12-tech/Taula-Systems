import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  getReservationsForDay, getReservationsForWeek, getReservationById, getAvailableSlotsForDate,
  getCustomerHistory, getOccupiedTableNumbers, createReservation, updateReservation,
  updateReservationStatus, cancelReservation, moveReservation,
} from '@/app/actions/reservations'
import { getRestaurant } from '@/app/actions/config'
import { getTables } from '@/app/actions/tables'
import { date, time, id, reply, todayMadrid } from './shared'

const section = z.enum(['indoor', 'outdoor']).describe('indoor = interior, outdoor = terrassa')

export function registerReservationTools(server: McpServer) {
  server.registerTool('reserves_del_dia', {
    title: 'Reserves del dia',
    description: "Llista totes les reserves d'un dia amb el seu id, hora, persones, client, telèfon, secció, taula, estat i notes. Si no s'indica data, avui.",
    inputSchema: { data: date.optional() },
    annotations: { readOnlyHint: true },
  }, async ({ data }) => reply(await getReservationsForDay(data ?? todayMadrid())))

  server.registerTool('reserves_periode', {
    title: "Reserves d'un període",
    description: 'Llista les reserves entre dues dates (incloses), agrupades per dia.',
    inputSchema: { des_de: date, fins_a: date },
    annotations: { readOnlyHint: true },
  }, async ({ des_de, fins_a }) => reply(await getReservationsForWeek(des_de, fins_a)))

  server.registerTool('reserva', {
    title: 'Detall de reserva',
    description: "Retorna totes les dades d'una reserva a partir del seu id.",
    inputSchema: { id },
    annotations: { readOnlyHint: true },
  }, async ({ id }) => reply(await getReservationById(id) ?? { error: 'Reserva no trobada' }))

  server.registerTool('disponibilitat', {
    title: 'Disponibilitat',
    description: "Diu si el restaurant obre un dia, les hores reservables i les places ocupades per secció. Amb una hora, també diu quines taules estan ocupades i quines lliures en aquell moment. La capacitat és orientativa: es pot reservar per sobre.",
    inputSchema: { data: date.optional(), hora: time.optional() },
    annotations: { readOnlyHint: true },
  }, async ({ data, hora }) => {
    const day = data ?? todayMadrid()
    const [{ restaurant }, franges, reserves, taules] = await Promise.all([
      getRestaurant(), getAvailableSlotsForDate(day), getReservationsForDay(day), getTables(),
    ])
    const occupied = (s: string) => reserves
      .filter(r => r.section === s && (r.status === 'pending' || r.status === 'arrived'))
      .reduce((sum, r) => sum + r.party_size, 0)

    let taulesAHora
    if (hora) {
      const isLunch = Number(hora.split(':')[0]) < 17
      const duration = isLunch ? restaurant.default_duration_lunch_min : restaurant.default_duration_dinner_min
      const ocupades = await getOccupiedTableNumbers(day, hora, duration)
      taulesAHora = {
        ocupades,
        lliures: taules.filter(t => !ocupades.includes(t.number)).map(t => ({ taula: t.number, seccio: t.section, places: t.capacity })),
      }
    }

    return reply({
      data: day,
      obert: franges.length > 0,
      franges,
      places: {
        interior: { capacitat: restaurant.capacity_indoor, ocupades: occupied('indoor') },
        terrassa: { capacitat: restaurant.capacity_outdoor, ocupades: occupied('outdoor') },
      },
      ...(taulesAHora ? { taules: taulesAHora } : {}),
    })
  })

  server.registerTool('historial_client', {
    title: 'Historial de client',
    description: 'Quantes vegades ha vingut un client (pel telèfon), quan va ser la darrera i la nota més recent.',
    inputSchema: { telefon: z.string().min(1) },
    annotations: { readOnlyHint: true },
  }, async ({ telefon }) => reply(await getCustomerHistory(telefon) ?? { visites: 0 }))

  server.registerTool('crear_reserva', {
    title: 'Crear reserva',
    description: "Crea una reserva. No es pot fer en un dia tancat. Si la taula ja està ocupada en aquell horari, dona error. Si se supera la capacitat de la secció, la crea igualment i retorna un avís que cal comunicar a l'usuari.",
    inputSchema: {
      data: date,
      hora: time,
      persones: z.number().int().min(1),
      seccio: section.default('indoor'),
      nom: z.string().min(1),
      telefon: z.string().default(''),
      email: z.string().optional(),
      notes: z.string().optional(),
      taula: z.string().optional().describe('Número de taula, p. ex. "8"'),
      durada_minuts: z.number().int().min(15).optional().describe("Si no s'indica, la durada per defecte del dinar o sopar"),
    },
  }, async (a) => reply(await createReservation({
    date: a.data, time: a.hora, party_size: a.persones, section: a.seccio,
    customer_name: a.nom, customer_phone: a.telefon, customer_email: a.email,
    notes: a.notes, table_number: a.taula, duration_minutes: a.durada_minuts,
  })))

  server.registerTool('modificar_reserva', {
    title: 'Modificar reserva',
    description: "Canvia dades d'una reserva existent. Només cal passar els camps que canvien.",
    inputSchema: {
      id,
      data: date.optional(),
      hora: time.optional(),
      persones: z.number().int().min(1).optional(),
      seccio: section.optional(),
      nom: z.string().min(1).optional(),
      telefon: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
      taula: z.string().optional().describe('Número de taula; cadena buida per treure-la'),
      durada_minuts: z.number().int().min(15).optional(),
    },
  }, async (a) => {
    const current = await getReservationById(a.id)
    if (!current) return reply({ error: 'Reserva no trobada' })
    return reply(await updateReservation(a.id, {
      date: a.data ?? current.date,
      time: a.hora ?? current.time,
      party_size: a.persones ?? current.party_size,
      section: a.seccio ?? current.section,
      customer_name: a.nom ?? current.customer_name,
      customer_phone: a.telefon ?? current.customer_phone,
      customer_email: a.email ?? current.customer_email ?? undefined,
      notes: a.notes ?? current.notes ?? undefined,
      table_number: a.taula ?? current.table_number ?? undefined,
      duration_minutes: a.durada_minuts ?? current.duration_minutes,
    }))
  })

  server.registerTool('moure_reserva', {
    title: 'Moure reserva de taula o hora',
    description: "Mou una reserva a una altra taula i/o hora del mateix dia. Dona error si la taula ja està ocupada en aquell horari.",
    inputSchema: { id, taula: z.string().min(1).describe('Número de taula de destí'), hora: time },
  }, async ({ id, taula, hora }) => {
    const table = (await getTables()).find(t => t.number === taula)
    if (!table) return reply({ error: `La taula ${taula} no existeix` })
    return reply(await moveReservation(id, table.id, hora))
  })

  server.registerTool('canviar_estat_reserva', {
    title: "Canviar l'estat d'una reserva",
    description: "Marca una reserva com a pendent (pending), arribada (arrived) o no presentada (no_show). Per cancel·lar, fes servir cancellar_reserva.",
    inputSchema: { id, estat: z.enum(['pending', 'arrived', 'no_show']) },
  }, async ({ id, estat }) => {
    await updateReservationStatus(id, estat)
    return reply({ ok: true })
  })

  server.registerTool('cancellar_reserva', {
    title: 'Cancel·lar reserva',
    description: "Cancel·la una reserva. Abans de fer-ho, confirma amb l'usuari quina reserva és (nom, dia i hora).",
    inputSchema: { id },
    annotations: { destructiveHint: true },
  }, async ({ id }) => reply(await cancelReservation(id)))
}
