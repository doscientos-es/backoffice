import { ShieldCheck } from 'lucide-react'
import { Suspense } from 'react'

import { LogoMark } from '@/components/branding'
import { PortalLanguageSwitch } from '@/components/portal/language-switch'
import { formatAddress } from '@/lib/address'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = {
  title: 'Portal · doscientos',
  robots: { index: false, follow: false },
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('settings')
    .select(
      'company_name, company_nif, company_address_street, company_address_zip, company_address_city, company_address_province, company_address_country',
    )
    .eq('id', 1)
    .maybeSingle()
  const companyAddress = settings
    ? formatAddress({
        street: settings.company_address_street,
        zip: settings.company_address_zip,
        city: settings.company_address_city,
        province: settings.company_address_province,
        country: settings.company_address_country,
      })
    : ''

  return (
    <div
      data-portal-shell
      className="relative flex min-h-screen flex-col overflow-x-clip bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white"
    >
      <header data-portal-header className="relative bg-white dark:bg-zinc-950">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} variant="auto" />
            <div className="leading-none">
              <p className="text-sm font-bold tracking-tight">doscientos</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Área de cliente</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-[#BDFF7B] px-2.5 py-1.5 text-[11px] font-medium text-zinc-950 max-sm:sr-only">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Acceso privado
            </div>
            <Suspense fallback={null}>
              <PortalLanguageSwitch />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      <footer data-portal-footer className="relative bg-white dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <span>© {new Date().getFullYear()} doscientos</span>
            <span>Este enlace contiene información privada. No lo compartas.</span>
          </div>
          <div className="flex flex-col justify-between gap-2 border-t border-black/[0.06] pt-3 sm:flex-row sm:items-center dark:border-white/[0.08]">
            <p className="max-w-2xl leading-relaxed">
              {settings?.company_name ? <strong>{settings.company_name}</strong> : 'doscientos'}
              {settings?.company_nif ? ` · NIF ${settings.company_nif}` : ''}
              {companyAddress ? ` · ${companyAddress.replaceAll('\n', ', ')}` : ''}
              {' · '}
              <a className="underline underline-offset-2" href="mailto:hola@doscientos.es">
                hola@doscientos.es
              </a>
            </p>
            <nav aria-label="Información legal" className="flex flex-wrap gap-x-4 gap-y-1">
              <a
                className="py-1 underline underline-offset-2 focus-visible:outline-2"
                href="https://doscientos.es/legal"
              >
                Aviso legal
              </a>
              <a
                className="py-1 underline underline-offset-2 focus-visible:outline-2"
                href="https://doscientos.es/terminos"
              >
                Términos
              </a>
              <a
                className="py-1 underline underline-offset-2 focus-visible:outline-2"
                href="https://doscientos.es/privacy"
              >
                Privacidad
              </a>
              <a
                className="py-1 underline underline-offset-2 focus-visible:outline-2"
                href="https://doscientos.es/cookies"
              >
                Cookies
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
