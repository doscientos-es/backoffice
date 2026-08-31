import Link from 'next/link'

import { Logo } from '@/components/branding'
import { CallReminderWatcher } from '@/components/layout/call-reminder-watcher'
import { CommandPalette } from '@/components/layout/command-palette'
import { CommandPaletteTrigger } from '@/components/layout/command-palette-trigger'
import { KeyboardShortcuts } from '@/components/layout/keyboard-shortcuts'
import { MobileNav } from '@/components/layout/mobile-nav'
import { NavProgress } from '@/components/layout/nav-progress'
import { QuickCreateButton } from '@/components/layout/quick-create-button'
import { ShortcutsDialog } from '@/components/layout/shortcuts-dialog'
import { Sidebar } from '@/components/layout/sidebar'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { MfaSessionGate } from '@/components/security/mfa-session-gate'
import { hasAal2Session, requireUser } from '@/lib/auth'
import { isPublicDemoMode } from '@/lib/demo'

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  const user = await requireUser()
  const demoMode = isPublicDemoMode()
  const mfaVerified = user.role === 'owner' || user.role === 'admin' ? await hasAal2Session() : true

  return (
    <div className="app-shell bg-background flex h-screen overflow-hidden">
      <Sidebar user={user} demoMode={demoMode} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="app-mobile-header border-border h-14 shrink-0 items-center gap-2 border-b px-3">
          <MobileNav user={user} demoMode={demoMode} />
          <Link
            href="/inicio"
            aria-label="doscientos · Inicio"
            className="focus-visible:ring-ring inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <Logo size="sm" />
          </Link>
          <CommandPaletteTrigger variant="icon" className="ml-auto" />
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
      {modal}
      <NavProgress />
      <CommandPalette />
      <KeyboardShortcuts />
      <ShortcutsDialog />
      <QuickCreateButton />
      <CallReminderWatcher />
      <MfaSessionGate memberRole={user.role} mfaVerified={mfaVerified} />
      <PwaInstallPrompt />
    </div>
  )
}
