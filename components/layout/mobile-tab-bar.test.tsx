import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CurrentUser } from '@/lib/auth'

import { MobileTabBar } from './mobile-tab-bar'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/tasks/new' }))
vi.mock('@/lib/navigation/navigation', () => ({
  visibleNavigationGroups: () => [
    {
      items: [
        { href: '/inicio', label: 'Inicio', icon: () => null },
        { href: '/calendar', label: 'Agenda', icon: () => null },
        { href: '/tasks', label: 'Tareas', icon: () => null },
        { href: '/leads', label: 'Leads', icon: () => null },
        { href: '/reminders', label: 'Recordatorios', icon: () => null },
      ],
    },
  ],
}))

const user = { role: 'admin' } as CurrentUser

describe('MobileTabBar', () => {
  it('shows the main destinations and marks a nested route as current', () => {
    render(<MobileTabBar user={user} />)

    expect(screen.getByRole('navigation', { name: 'Secciones principales' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Inicio' }).getAttribute('href')).toBe('/inicio')
    expect(screen.getByRole('link', { name: 'Tareas' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('link', { name: 'Recordatorios' })).toBeNull()
  })
})
