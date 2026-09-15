import { z } from 'zod'
import { getMondayISO } from '@/lib/dates'

export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Data en format YYYY-MM-DD')
export const time = z.string().regex(/^\d{2}:\d{2}$/).describe('Hora en format HH:MM')
export const id = z.string().min(1)

// El servidor de Vercel va en UTC; el restaurant viu a hora de Madrid
export function todayMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export function mondayOf(day: string | undefined): string {
  return getMondayISO(day ?? todayMadrid())
}

// Converteix el retorn d'una server action en resposta MCP. Les actions marquen
// els errors de negoci amb { error }; les excepcions les converteix l'SDK en error.
export function reply(value: unknown) {
  const isError = typeof value === 'object' && value !== null && 'error' in value
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value ?? { ok: true }, null, 2) }],
    ...(isError ? { isError: true } : {}),
  }
}
