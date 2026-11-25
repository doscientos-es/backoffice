'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

import { isPortalLanguage, type PortalLanguage } from '@/lib/portal/language'

const STORAGE_KEY = 'doscientos:portal-language'
const LANGUAGES: Array<{ value: PortalLanguage; label: string }> = [
  { value: 'es', label: 'ES' },
  { value: 'ca', label: 'CA' },
  { value: 'en', label: 'EN' },
]

function browserLanguage(): PortalLanguage {
  const preferences = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const preference of preferences) {
    const language = preference.toLowerCase().split('-')[0]
    if (isPortalLanguage(language)) return language
  }
  return 'es'
}

function storedLanguage(): PortalLanguage | undefined {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (isPortalLanguage(value)) return value
  } catch {
    // Storage may be blocked; the link and browser defaults still work.
  }
}

function saveLanguage(language: PortalLanguage) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // The link can still change the language for this page.
  }
}

function languageHref(pathname: string, query: string, language: PortalLanguage): string {
  const params = new URLSearchParams(query)
  params.set('lang', language)
  return `${pathname}?${params.toString()}`
}

export function PortalLanguageSwitch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const linkLanguage = searchParams.get('lang')
  const language = isPortalLanguage(linkLanguage) ? linkLanguage : 'es'

  useEffect(() => {
    // Shared links carry a default language, not a choice made by this visitor.
    const preferred =
      storedLanguage() ?? (isPortalLanguage(linkLanguage) ? linkLanguage : browserLanguage())
    if (preferred === linkLanguage) return
    router.replace(`${languageHref(pathname, query, preferred)}${window.location.hash}`, {
      scroll: false,
    })
  }, [linkLanguage, pathname, query, router])

  return (
    <nav
      aria-label="Idioma / Language / Llengua"
      className="inline-flex items-center gap-0.5 rounded-full border border-zinc-200 bg-white/90 p-1 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90"
    >
      {LANGUAGES.map(({ value, label }) => (
        <a
          key={value}
          href={languageHref(pathname, query, value)}
          onClick={() => saveLanguage(value)}
          lang={value}
          aria-current={language === value ? 'true' : undefined}
          aria-label={value === 'es' ? 'Español' : value === 'ca' ? 'Català' : 'English'}
          className={`rounded-full px-2.5 py-1.5 font-semibold transition-colors ${language === value ? 'bg-[#2A4227] text-white dark:bg-[#9CC196] dark:text-zinc-950' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}`}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
