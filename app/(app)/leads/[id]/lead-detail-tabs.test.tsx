import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

import { LeadDetailTabs, LeadTabLink, LeadTabPanel } from './lead-detail-tabs'

function Detail() {
  return (
    <>
      <LeadDetailTabs leadId="lead-1" />
      <LeadTabPanel tab="resumen">
        <p>Contenido resumen</p>
      </LeadTabPanel>
      <LeadTabPanel tab="actividad">
        <p>Contenido actividad</p>
      </LeadTabPanel>
      <LeadTabPanel tab="comercial">
        <p>Contenido comercial</p>
      </LeadTabPanel>
      <LeadTabLink leadId="lead-1" tab="actividad">
        Ver todo
      </LeadTabLink>
    </>
  )
}

beforeEach(() => window.history.replaceState(null, '', '/leads/lead-1'))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('lead detail tabs', () => {
  it('switches tabs through browser history without a navigation request', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const { rerender } = render(<Detail />)
    expect(screen.getByText('Contenido resumen')).toBeDefined()

    fireEvent.click(screen.getByRole('tab', { name: 'Actividad' }))
    expect(push).toHaveBeenCalledWith(null, '', '/leads/lead-1?tab=actividad')
    rerender(<Detail />) // Next updates useSearchParams after pushState.
    expect(screen.getByText('Contenido actividad')).toBeDefined()
    expect(screen.queryByText('Contenido resumen')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Actividad' }).getAttribute('aria-selected')).toBe(
      'true',
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Comercial' }))
    rerender(<Detail />)
    expect(screen.getByText('Contenido comercial')).toBeDefined()
  })

  it('opens direct links and falls back to summary for an unknown tab', () => {
    window.history.replaceState(null, '', '/leads/lead-1?tab=comercial')
    const { rerender } = render(<Detail />)
    expect(screen.getByText('Contenido comercial')).toBeDefined()
    window.history.replaceState(null, '', '/leads/lead-1?tab=unknown')
    rerender(<Detail />)
    expect(screen.getByText('Contenido resumen')).toBeDefined()
  })

  it('lets modified clicks use the normal link behavior', () => {
    const push = vi.spyOn(window.history, 'pushState')
    render(<Detail />)
    const link = screen.getByRole('tab', { name: 'Actividad' })
    expect(link.getAttribute('href')).toBe('/leads/lead-1?tab=actividad')
    fireEvent.click(link, { ctrlKey: true })
    expect(push).not.toHaveBeenCalled()
  })
})
