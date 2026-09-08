import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeadRelatedLinks } from './lead-related-links'

describe('LeadRelatedLinks', () => {
  it('opens each commercial list filtered by the current lead', () => {
    render(<LeadRelatedLinks leadId="lead-1" counts={{ proposals: 2, projects: 1, invoices: 3 }} />)

    expect(screen.getByRole('link', { name: 'Propuestas 2' }).getAttribute('href')).toBe(
      '/proposals?lead=lead-1',
    )
    expect(screen.getByRole('link', { name: 'Proyectos 1' }).getAttribute('href')).toBe(
      '/projects?lead=lead-1',
    )
    expect(screen.getByRole('link', { name: 'Facturas 3' }).getAttribute('href')).toBe(
      '/invoices?lead=lead-1',
    )
  })
})