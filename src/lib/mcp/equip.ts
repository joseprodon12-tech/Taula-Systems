import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  getEmployees, createEmployee, updateEmployee, deactivateEmployee, reactivateEmployee,
  getShiftsForDay, getShiftsForWeek, createShift, updateShift, deleteShift,
  deleteShiftsForDay, deleteShiftsForWeek, duplicateWeek, publishWeek,
  getAbsencesForRange, createAbsence, deleteAbsence,
} from '@/app/actions/equip'
import { addDays } from '@/lib/dates'
import { date, time, id, reply, todayMadrid, mondayOf } from './shared'

const week = date.optional().describe("Qualsevol dia de la setmana (YYYY-MM-DD). Si no s'indica, la setmana actual.")

export function registerTeamTools(server: McpServer) {
  // ─── Empleats ──────────────────────────────────────────────────────────────

  server.registerTool('empleats', {
    title: 'Empleats',
    description: "Llista els empleats amb id, nom, rol, color, telèfon i hores de contracte.",
    inputSchema: { inclou_inactius: z.boolean().default(false) },
    annotations: { readOnlyHint: true },
  }, async ({ inclou_inactius }) => reply(await getEmployees({ includeInactive: inclou_inactius })))

  server.registerTool('crear_empleat', {
    title: 'Crear empleat',
    description: 'Dona d\'alta un empleat. Només el propietari.',
    inputSchema: {
      nom: z.string().min(1),
      rol: z.string().min(1).describe('Rol o secció, p. ex. "Sala", "Cuina", "Barra"'),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).describe('Color hex per identificar-lo al quadrant, p. ex. "#2E5BFF"'),
      telefon: z.string().optional(),
      hores_contracte: z.number().min(0).optional().describe('Hores setmanals de contracte'),
    },
  }, async (a) => reply(await createEmployee({
    name: a.nom, role_label: a.rol, color: a.color, phone: a.telefon, contract_hours_week: a.hores_contracte,
  })))

  server.registerTool('modificar_empleat', {
    title: 'Modificar empleat',
    description: "Canvia dades d'un empleat. Només cal passar els camps que canvien. Només el propietari.",
    inputSchema: {
      id,
      nom: z.string().min(1).optional(),
      rol: z.string().min(1).optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      telefon: z.string().optional(),
      hores_contracte: z.number().min(0).optional(),
    },
  }, async (a) => {
    const current = (await getEmployees({ includeInactive: true })).find(e => e.id === a.id)
    if (!current) return reply({ error: 'Empleat no trobat' })
    return reply(await updateEmployee(a.id, {
      name: a.nom ?? current.name,
      role_label: a.rol ?? current.role_label,
      color: a.color ?? current.color,
      phone: a.telefon ?? current.phone,
      contract_hours_week: a.hores_contracte ?? current.contract_hours_week,
    }))
  })

  server.registerTool('desactivar_empleat', {
    title: 'Desactivar empleat',
    description: "Dona de baixa un empleat (deixa d'aparèixer al quadrant; es pot reactivar). Confirma-ho abans amb l'usuari. Només el propietari.",
    inputSchema: { id },
    annotations: { destructiveHint: true },
  }, async ({ id }) => reply(await deactivateEmployee(id)))

  server.registerTool('reactivar_empleat', {
    title: 'Reactivar empleat',
    description: 'Torna a donar d\'alta un empleat desactivat. Només el propietari.',
    inputSchema: { id },
  }, async ({ id }) => reply(await reactivateEmployee(id)))

  // ─── Torns ────────────────────────────────────────────────────────────────

  server.registerTool('torns_del_dia', {
    title: 'Torns del dia',
    description: "Llista els torns d'un dia amb id, empleat, hores, zona, notes i si estan publicats.",
    inputSchema: { data: date.optional() },
    annotations: { readOnlyHint: true },
  }, async ({ data }) => reply(await getShiftsForDay(data ?? todayMadrid())))

  server.registerTool('torns_setmana', {
    title: "Torns d'una setmana",
    description: 'Llista els torns de dilluns a diumenge, agrupats per dia (inclou employee_id; els noms surten a "empleats").',
    inputSchema: { setmana: week },
    annotations: { readOnlyHint: true },
  }, async ({ setmana }) => {
    const monday = mondayOf(setmana)
    return reply(await getShiftsForWeek(monday, addDays(monday, 6)))
  })

  server.registerTool('crear_torn', {
    title: 'Crear torn',
    description: "Crea un torn (queda com a esborrany fins que es publica la setmana). Dona error si l'empleat ja té un torn que es solapa. Només el propietari.",
    inputSchema: {
      empleat_id: id,
      data: date,
      inici: time,
      fi: time,
      zona: z.string().optional(),
      notes: z.string().optional(),
    },
  }, async (a) => reply(await createShift({
    employee_id: a.empleat_id, date: a.data, start_time: a.inici, end_time: a.fi, zone: a.zona, notes: a.notes,
  })))

  server.registerTool('modificar_torn', {
    title: 'Modificar torn',
    description: "Canvia un torn existent (empleat, dia o hores). Cal passar tots els camps; consulta'ls abans amb torns_del_dia. Només el propietari.",
    inputSchema: {
      id,
      empleat_id: id,
      data: date,
      inici: time,
      fi: time,
      zona: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    },
  }, async (a) => reply(await updateShift(a.id, {
    employee_id: a.empleat_id, date: a.data, start_time: a.inici, end_time: a.fi, zone: a.zona, notes: a.notes,
  })))

  server.registerTool('eliminar_torn', {
    title: 'Eliminar torn',
    description: "Esborra un torn. Confirma-ho abans amb l'usuari. Només el propietari.",
    inputSchema: { id },
    annotations: { destructiveHint: true },
  }, async ({ id }) => reply(await deleteShift(id)))

  server.registerTool('eliminar_torns_dia', {
    title: "Eliminar tots els torns d'un dia",
    description: "Esborra TOTS els torns d'un dia. Confirma-ho abans amb l'usuari. Només el propietari.",
    inputSchema: { data: date },
    annotations: { destructiveHint: true },
  }, async ({ data }) => reply(await deleteShiftsForDay(data)))

  server.registerTool('eliminar_torns_setmana', {
    title: "Eliminar tots els torns d'una setmana",
    description: "Esborra TOTS els torns de dilluns a diumenge. Confirma-ho abans amb l'usuari. Només el propietari.",
    inputSchema: { setmana: date.describe('Qualsevol dia de la setmana (YYYY-MM-DD)') },
    annotations: { destructiveHint: true },
  }, async ({ setmana }) => {
    const monday = mondayOf(setmana)
    return reply(await deleteShiftsForWeek(monday, addDays(monday, 6)))
  })

  server.registerTool('duplicar_setmana', {
    title: 'Duplicar setmana',
    description: "Copia els torns d'una setmana a una altra (com a esborrany). Salta empleats inactius o amb absència aquell dia. Només el propietari.",
    inputSchema: {
      des_de_setmana: date.describe('Qualsevol dia de la setmana d\'origen'),
      a_setmana: date.describe('Qualsevol dia de la setmana de destí'),
    },
  }, async ({ des_de_setmana, a_setmana }) => reply(await duplicateWeek(mondayOf(des_de_setmana), mondayOf(a_setmana))))

  server.registerTool('publicar_setmana', {
    title: 'Publicar setmana',
    description: 'Publica tots els torns en esborrany de la setmana perquè l\'equip els vegi. Només el propietari.',
    inputSchema: { setmana: week },
  }, async ({ setmana }) => reply(await publishWeek(mondayOf(setmana))))

  // ─── Absències ────────────────────────────────────────────────────────────

  server.registerTool('absencies', {
    title: 'Absències',
    description: 'Llista vacances, baixes, dies lliures i altres absències que toquen un període.',
    inputSchema: { des_de: date, fins_a: date },
    annotations: { readOnlyHint: true },
  }, async ({ des_de, fins_a }) => reply(await getAbsencesForRange(des_de, fins_a)))

  server.registerTool('crear_absencia', {
    title: 'Crear absència',
    description: "Registra una absència d'un empleat entre dues dates (incloses). Només el propietari.",
    inputSchema: {
      empleat_id: id,
      des_de: date,
      fins_a: date,
      tipus: z.enum(['vacances', 'baixa', 'lliure', 'altres']),
      notes: z.string().optional(),
    },
  }, async (a) => reply(await createAbsence({
    employee_id: a.empleat_id, date_from: a.des_de, date_to: a.fins_a, type: a.tipus, notes: a.notes,
  })))

  server.registerTool('eliminar_absencia', {
    title: 'Eliminar absència',
    description: "Esborra una absència. Confirma-ho abans amb l'usuari. Només el propietari.",
    inputSchema: { id },
    annotations: { destructiveHint: true },
  }, async ({ id }) => reply(await deleteAbsence(id)))
}
