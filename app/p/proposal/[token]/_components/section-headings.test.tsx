import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeTr } from '../_lib/i18n'
import { PortalNarrativeBlock } from '../narrative'
import { LineItems } from './line-items'
import { ScopeSection } from './scope-section'
import { TeamSection } from './team-section'
import { NotesSection, TermsSection } from './terms-section'

afterEach(cleanup)

describe('proposal section headings', () => {
  it('uses the same typography for independent sections', () => {
    const tr = makeTr('es')
    render(
      <>
        <PortalNarrativeBlock label="Contexto">Contexto de ejemplo</PortalNarrativeBlock>
        <ScopeSection modules={[]} deliverables="Entrega" acceptanceCriteria="" tr={tr} />
        <TeamSection
          team={[{ id: '1', name: 'Alex', job_title: null, avatar_url: null, contactEmail: null }]}
          tr={tr}
        />
        <LineItems items={[]} hasRecurring={false} language="es" tr={tr} />
        <TermsSection
          paymentTerms="Pago"
          paymentSchedule="upfront"
          changeManagementTerms={null}
          tr={tr}
        />
        <NotesSection notes="Aclaración" tr={tr} />
      </>,
    )

    for (const name of [
      'Contexto',
      'Alcance del proyecto',
      'El equipo',
      'Detalle de la inversión',
      'Condiciones',
      'Notas',
    ]) {
      const heading = screen.getByRole('heading', { level: 2, name })
      expect(heading.classList.contains('text-lg')).toBe(true)
      expect(heading.classList.contains('font-semibold')).toBe(true)
      expect(heading.classList.contains('tracking-tight')).toBe(true)
    }
    expect(
      screen
        .getByRole('heading', { level: 3, name: 'Entregables' })
        .classList.contains('text-base'),
    ).toBe(true)
  })

  it('uses authored headings instead of adding another heading to each scope column', () => {
    render(
      <ScopeSection
        modules={[]}
        deliverables={'### Lliurables\n\n- Plataforma web\n\n#### Documentació\n\n- Guia d’ús'}
        acceptanceCriteria={'### Validació i acceptació\n\n- Revisió conjunta'}
        tr={makeTr('ca')}
      />,
    )

    expect(screen.getAllByRole('heading').map(({ textContent }) => textContent)).toEqual([
      'Abast del projecte',
      'Lliurables',
      'Documentació',
      'Validació i acceptació',
    ])
    expect(screen.getAllByRole('listitem').map(({ textContent }) => textContent)).toEqual([
      'Plataforma web',
      'Guia d’ús',
      'Revisió conjunta',
    ])
  })

  it('shows module titles without a decorative module label', () => {
    render(
      <ScopeSection
        modules={[{ id: '1', title: 'Magatzem', included: ['Estoc'], excluded: [] }]}
        deliverables=""
        acceptanceCriteria=""
        tr={makeTr('ca')}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Magatzem' })).toBeDefined()
    expect(screen.queryByText('Mòdul 01')).toBeNull()
    expect(screen.getByText('Estoc')).toBeDefined()
  })
})
