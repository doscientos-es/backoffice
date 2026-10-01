import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import { Toaster } from 'sileo'

import { LogoMark } from '@/components/branding'
import { PwaRegister } from '@/components/pwa-register'
import { ThemeProvider } from '@/components/theme-provider'
import { STARTUP_SPLASH_SESSION_KEY } from '@/lib/startup-splash'
import { cn } from '@/lib/utils'

import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'doscientos backoffice',
  description: 'CRM interno de doscientos · Leads, propuestas, facturas Verifactu.',
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Doscientos',
  },
  icons: {
    icon: [
      {
        url: '/brand/logo-light.svg',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: light)',
      },
      { url: '/brand/logo.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    ],
    shortcut: '/brand/logo.svg',
    apple: '/brand/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#2a4227' },
  ],
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={cn('font-sans', geist.variable)}>
      <body>
        <Script id="startup-splash-state" strategy="beforeInteractive">
          {`try { if (sessionStorage.getItem("${STARTUP_SPLASH_SESSION_KEY}")) document.documentElement.dataset.startupSplashSeen = "true"; } catch {} window.setTimeout(() => document.getElementById("startup-splash")?.classList.add("is-hidden"), 1200);`}
        </Script>
        <div id="startup-splash" role="status" aria-label="Cargando Doscientos">
          <div className="startup-splash-mark-shell">
            <LogoMark size={112} variant="light" className="startup-splash-mark" />
          </div>
          <div className="startup-splash-copy">
            <strong>doscientos</strong>
            <span>BACKOFFICE</span>
            <small>CRM interno</small>
          </div>
          <div className="startup-splash-progress" aria-hidden="true">
            <i />
          </div>
        </div>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  )
}
