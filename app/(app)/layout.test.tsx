import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({ default: () => null }))
vi.mock('@/components/branding', () => ({ Logo: () => null }))
vi.mock('@/components/layout/call-reminder-watcher', () => ({ CallReminderWatcher: () => null }))
vi.mock('@/components/layout/command-palette-loader', () => ({ CommandPaletteLoader: () => null }))
vi.mock('@/components/layout/command-palette-trigger', () => ({
  CommandPaletteTrigger: () => null,
}))
vi.mock('@/components/layout/keyboard-shortcuts', () => ({ KeyboardShortcuts: () => null }))
vi.mock('@/components/layout/mobile-nav', () => ({ MobileNav: () => null }))
vi.mock('@/components/layout/mobile-tab-bar', () => ({ MobileTabBar: () => null }))
vi.mock('@/components/layout/nav-progress', () => ({ NavProgress: () => null }))
vi.mock('@/components/layout/shortcuts-dialog', () => ({ ShortcutsDialog: () => null }))
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => null }))
vi.mock('@/components/pwa-install-prompt', () => ({ PwaInstallPrompt: () => null }))
vi.mock('@/components/security/mfa-session-gate', () => ({ MfaSessionGate: () => null }))
vi.mock('@/lib/auth', () => ({
  hasMfaAccess: vi.fn(),
  requireUser: async () => ({ id: 'member-1', name: 'Ana', role: 'viewer' }),
}))

import AppLayout from './layout'

function findElement(node: ReactNode, tag: string): ReactElement<{ className?: string }> | null {
  let found: ReactElement<{ className?: string }> | null = null
  Children.forEach(node, (child) => {
    if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) return
    if (child.type === tag) {
      found = child as ReactElement<{ className?: string }>
      return
    }
    found ??= findElement(child.props.children, tag)
  })
  return found
}

describe('authenticated app mobile layout', () => {
  it('does not reserve bottom-navigation space twice in the main content', async () => {
    const tree = await AppLayout({ children: null, modal: null })
    const main = findElement(tree, 'main')

    expect(main?.props.className).toContain('pb-4')
    expect(main?.props.className).not.toContain('pb-24')
    expect(main?.props.className).toContain('md:py-6')
  })
})
