import Link from 'next/link'

import { Logo } from '@/components/branding'
import { CallReminderWatcher } from '@/components/layout/call-reminder-watcher'
import { CommandPalette } from '@/components/layout/command-palette'
import { CommandPaletteTrigger } from '@/components/layout/command-palette-trigger'
import { KeyboardShortcuts } from '@/components/layout/keyboard-shortcuts'
import { MobileNav } from '@/components/layout/mobile-nav'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { NavProgress } from '@/components/layout/nav-progress'
import { ShortcutsDialog } from '@/components/layout/shortcuts-dialog'
import { Sidebar } from '@/components/layout/sidebar'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { MfaSessionGate } from '@/components/security/mfa-session-gate'
import { hasMfaAccess, requireUser } from '@/lib/auth'

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  const user = await requireUser()
  const mfaVerified =
    user.role === 'owner' || user.role === 'admin' ? await hasMfaAccess(user.id) : true

  return (
    <div className="app-shell flex h-dvh overflow-hidden bg-background">
      <Sidebar user={user} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="app-mobile-header h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <MobileNav user={user} />
          <Link
            href="/inicio"
            aria-label="doscientos · Inicio"
            className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Logo size="sm" />
          </Link>
          <CommandPaletteTrigger variant="icon" className="ml-auto" />
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-24 md:px-6 md:py-6">
          {children}
        </main>
      </div>
      <MobileTabBar user={user} />
      {modal}
      <NavProgress />
      <CommandPalette role={user.role} />
      <KeyboardShortcuts />
      <ShortcutsDialog />
      <CallReminderWatcher />
      <MfaSessionGate memberRole={user.role} mfaVerified={mfaVerified} />
      <PwaInstallPrompt />
    </div>
  )
}
