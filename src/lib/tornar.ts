// Última pantalla de treball (Avui o Agenda amb la seva vista) per tornar-hi després de crear o cancel·lar una reserva
const KEY = 'taula_tornar'

export function rememberReturnView() {
  sessionStorage.setItem(KEY, window.location.pathname + window.location.search)
}

export function returnView(date: string, fallback: string): string {
  const saved = sessionStorage.getItem(KEY)
  if (!saved) return fallback
  const url = new URL(saved, window.location.origin)
  url.searchParams.delete('avis')
  url.searchParams.delete('seccio')
  url.searchParams.set('data', date)
  return url.pathname + url.search
}
