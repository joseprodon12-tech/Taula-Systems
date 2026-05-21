'use client'

import { useState, useEffect } from 'react'
import { type Locale, getT } from '@/lib/i18n'

export function useT() {
  const [locale, setLocale] = useState<Locale>('ca')

  useEffect(() => {
    const saved = localStorage.getItem('taula_locale') as Locale | null
    if (saved === 'ca' || saved === 'es') setLocale(saved)
  }, [])

  function changeLocale(newLocale: Locale) {
    localStorage.setItem('taula_locale', newLocale)
    setLocale(newLocale)
  }

  return { t: getT(locale), locale, changeLocale }
}
