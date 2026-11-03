import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeTr, type PortalLanguage } from '../_lib/i18n'
import { TeamSection } from './team-section'

afterEach(cleanup)

const team = [
  {
    id: '1',
    name: 'Alex Example',
    job_title: 'Designer',
    avatar_url: 'https://example.test/avatar.png',
    contactEmail: 'alex+project@example.test',
  },
  { id: '2', name: 'Sam Example', job_title: null, avatar_url: null, contactEmail: null },
]

describe('TeamSection', () => {
  it.each<{ language: PortalLanguage; heading: string; link: string }>([
    { language: 'es', heading: 'El equipo', link: 'Enviar email a Alex Example' },
    { language: 'ca', heading: 'L’equip', link: 'Enviar correu a Alex Example' },
    { language: 'en', heading: 'The team', link: 'Email Alex Example' },
  ])('shows the assigned team and email link in $language', ({ language, heading, link }) => {
    render(<TeamSection team={team} tr={makeTr(language)} />)

    expect(screen.getByRole('heading', { name: heading })).toBeDefined()
    const contact = screen.getByRole('link', { name: link })
    expect(contact.getAttribute('href')).toBe('mailto:alex%2Bproject@example.test')
    expect(within(contact).getByRole('presentation').getAttribute('src')).toBe(
      'https://example.test/avatar.png',
    )
    expect(within(contact).getByText('Designer')).toBeDefined()
    expect(screen.getByText('Sam Example')).toBeDefined()
    expect(screen.getByText('S')).toBeDefined()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('omits the section when no team is assigned', () => {
    const { container } = render(<TeamSection team={[]} tr={makeTr('es')} />)
    expect(container.firstChild).toBeNull()
  })
})
