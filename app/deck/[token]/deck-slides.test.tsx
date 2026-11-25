import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildSlides } from './deck-slides'
import { DeckViewer } from './deck-viewer-client'
import type { DeckProposal } from './page'

vi.mock('next/navigation', () => ({ useRouter: () => ({ prefetch: vi.fn() }) }))

const proposal: DeckProposal = {
  id: 'proposal-1',
  number: 'P-001',
  title: 'Propuesta de prueba',
  context_markdown: null,
  problems: [],
  solutions: [],
  terms: null,
  scope_modules: [],
  deliverables: ' \n ',
  acceptance_criteria: '\n',
  payment_schedule: 'half_half',
  payment_terms: null,
  change_management_terms: null,
  notes: null,
  subtotal: 0,
  tax_amount: 0,
  total: 0,
  discount_type: 'none',
  discount_value: 0,
  discount_reason: null,
  valid_until: null,
  created_at: null,
  client_name: null,
  client_email: null,
  client_logo_url: null,
}

describe('buildSlides', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('opens timeline details on mobile without navigating, and preserves keyboard activation', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    localStorage.setItem('deckHelpSeen', '1')
    const timeline = [
      {
        id: 'design',
        title: 'Diseño',
        description: 'Detalle del diseño',
        start_date: '2028-02-28',
        end_date: '2028-02-29',
      },
    ]
    const { container } = render(
      <DeckViewer proposal={{ ...proposal, timeline }} items={[]} team={[]} token="portal-token" />,
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    const stage = container.querySelector<HTMLElement>('.deck-stage')
    expect(stage?.style.transform).toBe('translateX(-100%)')
    const summary = stage?.querySelector('[data-active="true"] summary')
    if (!summary) throw new Error('Missing milestone summary')
    expect(fireEvent.keyDown(summary, { key: ' ', cancelable: true })).toBe(true)
    expect(stage?.style.transform).toBe('translateX(-100%)')
    fireEvent.click(summary)
    expect(summary.closest('details')?.open).toBe(true)
    expect(stage?.style.transform).toBe('translateX(-100%)')
  })

  it('splits timelines across slides and offers the complete calendar', () => {
    const timeline = Array.from({ length: 5 }, (_, index) => ({
      id: `item-${index}`,
      title: `Hito ${index + 1}`,
      description: '',
      start_date: `2026-12-0${5 - index}`,
      end_date: `2026-12-0${5 - index}`,
    }))
    const slides = buildSlides({ ...proposal, timeline }, [], 'portal-token')
    expect(slides.map((slide) => slide.key)).toContain('timeline-4')
    render(slides.find((slide) => slide.key === 'timeline-0')?.element)
    expect(screen.getByText('Hito 5')).toBeDefined()
    const href =
      screen.getByRole('link', { name: /Añadir a mi calendario/ }).getAttribute('href') ?? ''
    expect(decodeURIComponent(href).match(/BEGIN:VEVENT/g)).toHaveLength(5)
  })

  it('omits the delivery slide when deliverables and criteria only contain whitespace', () => {
    const slides = buildSlides(proposal, [], 'portal-token')

    expect(slides).not.toContainEqual(expect.objectContaining({ key: 'delivery' }))
  })

  it('omits the context slide when context only contains whitespace', () => {
    const slides = buildSlides({ ...proposal, context_markdown: ' \n ' }, [], 'portal-token')

    expect(slides).not.toContainEqual(expect.objectContaining({ key: 'context' }))
  })

  it.each([undefined, null, '', ' \n '])(
    'omits the development approach slide for empty content: %s',
    (development_approach) => {
      expect(
        buildSlides({ ...proposal, development_approach }, [], 'portal-token'),
      ).not.toContainEqual(expect.objectContaining({ key: 'development-approach' }))
    },
  )

  it('renders development Markdown after the complete scope and before the team', () => {
    const slides = buildSlides(
      {
        ...proposal,
        scope_modules: [{ id: 'module-1', title: 'Portal', included: [], excluded: [] }],
        deliverables: 'Portal publicado',
        development_approach: '**Revisión semanal** con el cliente.',
      },
      [],
      'portal-token',
      [{ id: 'member-1', name: 'Equipo', job_title: null, avatar_url: null }],
    )
    expect(slides.map((slide) => slide.key)).toEqual([
      'cover',
      'scope-module-1',
      'delivery',
      'development-approach',
      'team',
      'closing',
    ])
    render(slides.find((slide) => slide.key === 'development-approach')?.element)
    expect(
      screen.getByRole('heading', { name: 'Cómo trabajaremos durante el desarrollo' }),
    ).toBeDefined()
    expect(screen.getByText('Revisión semanal').tagName).toBe('STRONG')
  })

  it('includes the delivery slide when either field has meaningful content', () => {
    const slides = buildSlides(
      { ...proposal, deliverables: '- Sitio web publicado' },
      [],
      'portal-token',
    )

    expect(slides).toContainEqual(expect.objectContaining({ key: 'delivery' }))
  })

  it('only adds a default delivery heading when the content does not start with one', () => {
    const slides = buildSlides(
      {
        ...proposal,
        deliverables: '### Entregables\n\n- Portal publicado',
        acceptance_criteria: '- Revisión conjunta\n\n#### Soporte\n\nRespuesta acordada.',
      },
      [],
      'portal-token',
    )
    render(slides.find((slide) => slide.key === 'delivery')?.element)

    expect(screen.getAllByText('Entregables')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Criterios de aceptación' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Soporte' })).toBeDefined()
  })

  it.each([
    ['ca', 'Termini estimat: 2 setmanes', 'Veure i acceptar la proposta'],
    ['en', 'Estimated duration: 2 weeks', 'View and accept proposal'],
  ] as const)(
    'localizes slides and preserves the %s language in links',
    (language, duration, accept) => {
      const slides = buildSlides(
        {
          ...proposal,
          scope_modules: [
            {
              id: 'scope',
              title: 'Custom scope',
              included: ['Custom content'],
              excluded: [],
              duration_mode: 'weeks',
              duration_weeks: 2,
            },
          ],
          payment_terms: 'Custom terms',
        },
        [],
        'portal-token',
        [],
        undefined,
        language,
      )
      render(
        <div>
          {slides.map((slide) => (
            <div key={slide.key}>{slide.element}</div>
          ))}
        </div>,
      )
      expect(screen.getByText(duration)).toBeDefined()
      expect(slides.some((slide) => slide.key === 'terms')).toBe(false)
      expect(screen.getByText('Custom content')).toBeDefined()
      expect(screen.getByRole('link', { name: accept }).getAttribute('href')).toBe(
        `/p/proposal/portal-token?lang=${language}`,
      )
      expect(
        document.querySelector(`a[href="/p/proposal/portal-token/pdf?lang=${language}"]`),
      ).not.toBeNull()
      expect(slides.find((slide) => slide.key === 'scope-scope')?.label).toBe(
        language === 'ca' ? 'Mòdul 1' : 'Module 1',
      )
    },
  )

  it('emphasizes pre-VAT pricing and still shows the estimated total including VAT', () => {
    const slides = buildSlides(
      proposal,
      [
        {
          id: 'item-1',
          description: 'Implementación',
          quantity: 1,
          unit_price: 3000,
          vat_rate: 21,
          subtotal: 3000,
          billing_cycle: 'none',
        },
      ],
      'portal-token',
    )
    const pricingSlide = slides.find((slide) => slide.key === 'pricing')

    expect(pricingSlide).toBeDefined()
    render(pricingSlide?.element)

    expect(screen.getByText('Importe antes de IVA')).toBeDefined()
    expect(screen.getByText('IVA aplicable')).toBeDefined()
    expect(screen.getByText('Total previsto con IVA')).toBeDefined()
    expect(screen.getByText('Importe antes de IVA').nextElementSibling?.textContent).toMatch(
      /^3000,00/,
    )
    expect(screen.getByText('IVA aplicable').nextElementSibling?.textContent).toMatch(/^630,00/)
    expect(screen.getByText('Total previsto con IVA').nextElementSibling?.textContent).toMatch(
      /^3630,00/,
    )
  })
})
