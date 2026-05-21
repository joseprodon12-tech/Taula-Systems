'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { type Locale, getT } from '@/lib/i18n'

type LocaleContextType = {
  locale: Locale
  changeLocale: (l: Locale) => void
  t: ReturnType<typeof getT>
}

const LocaleContext = createContext<LocaleContextType | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('ca')

  useEffect(() => {
    const saved = localStorage.getItem('taula_locale') as Locale | null
    if (saved === 'ca' || saved === 'es') setLocale(saved)
  }, [])

  function changeLocale(newLocale: Locale) {
    localStorage.setItem('taula_locale', newLocale)
    setLocale(newLocale)
  }

  return (
    <LocaleContext.Provider value={{ locale, changeLocale, t: getT(locale) }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useT() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useT must be used within LocaleProvider')
  return ctx
}
