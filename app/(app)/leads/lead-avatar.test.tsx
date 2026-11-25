import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LeadAvatar } from './lead-avatar'

afterEach(cleanup)

describe('LeadAvatar', () => {
  it('prefers the uploaded logo, then a corporate icon, then initials', () => {
    render(<LeadAvatar name="Acme Example" email="ana@example.test" logoUrl="/logo.png" />)
    const image = () => screen.getByRole('img', { name: 'Acme Example' })
    expect(image().getAttribute('src')).toBe('/logo.png')
    fireEvent.error(image())
    expect(image().getAttribute('src')).toBe('/api/leads/company-icon?domain=example.test')
    fireEvent.error(image())
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('AE')).toBeTruthy()
  })

  it('avoids provider logos and recovers when the domain changes', () => {
    const view = render(<LeadAvatar name="Acme Example" email="ana@gmail.com" company="Acme" />)
    expect(screen.getByText('AE')).toBeTruthy()
    view.rerender(<LeadAvatar name="Acme Example" email="ana@example.test" />)
    fireEvent.error(screen.getByRole('img'))
    view.rerender(<LeadAvatar name="Acme Example" email="ana@other.test" />)
    expect(screen.getByRole('img').getAttribute('src')).toContain('other.test')
  })

  it('uses a researched domain or an explicit company domain with personal email', () => {
    const view = render(
      <LeadAvatar name="Acme" email="ana@gmail.com" researchedDomain="EXAMPLE.TEST" />,
    )
    expect(screen.getByRole('img').getAttribute('src')).toContain('example.test')
    view.rerender(<LeadAvatar name="Acme" email={null} company="other.test" />)
    expect(screen.getByRole('img').getAttribute('src')).toContain('other.test')
  })
})
