import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { getPortalCopy, getStatusLabel, type PortalLanguage } from '../_lib/i18n'
import { DocumentHeader, RecipientBlock } from './document-header'

afterEach(cleanup)

const baseProps = {
  token: 'example-proposal',
  language: 'es' as const,
  copy: getPortalCopy('es'),
  proposalNumber: 'PROP-2026-001',
  title: 'Una nueva experiencia digital',
  validUntil: '2026-11-10',
  daysLeft: 7,
  status: 'sent',
  statusLabel: getStatusLabel('es', 'sent'),
}

describe('DocumentHeader', () => {
  it.each<PortalLanguage>(['es', 'ca', 'en'])(
    'keeps the title, status and PDF download available in %s',
    (language) => {
      const copy = getPortalCopy(language)
      const statusLabel = getStatusLabel(language, 'sent')
      render(
        <DocumentHeader {...baseProps} language={language} copy={copy} statusLabel={statusLabel} />,
      )

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(baseProps.title)
      expect(screen.getByText(statusLabel)).toBeDefined()
      expect(screen.getByRole('link', { name: copy.download }).getAttribute('href')).toBe(
        `/p/proposal/example-proposal/pdf?lang=${language}`,
      )
    },
  )

  it.each([
    [0, 'Último día para aceptar'],
    [1, 'Queda 1 día'],
    [7, 'Quedan 7 días'],
  ])('preserves the pending deadline for %s days left', (daysLeft, label) => {
    render(<DocumentHeader {...baseProps} daysLeft={daysLeft} />)
    expect(screen.getByText(label)).toBeDefined()
  })

  it.each(['accepted', 'rejected', 'expired'] as const)(
    'does not show urgency for a proposal that is %s',
    (status) => {
      render(<DocumentHeader {...baseProps} status={status} daysLeft={1} />)
      expect(screen.queryByText('Queda 1 día')).toBeNull()
    },
  )

  it('omits the deadline when none is set', () => {
    render(<DocumentHeader {...baseProps} validUntil={null} daysLeft={null} />)
    expect(screen.queryByText(/Válida hasta/)).toBeNull()
    expect(screen.queryByText(/Quedan/)).toBeNull()
  })
})

describe('RecipientBlock', () => {
  it('identifies the recipient without depending on a logo', () => {
    render(<RecipientBlock label="Dirigido a" name="Acme Studio" logoUrl={null} />)
    expect(screen.getByText('Acme Studio')).toBeDefined()
    expect(screen.getByText('A').getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('keeps the client logo and its accessible name when supplied', () => {
    render(<RecipientBlock label="Dirigido a" name="Acme Studio" logoUrl="/example-logo.svg" />)
    expect(screen.getByRole('img', { name: 'Logo Acme Studio' }).getAttribute('src')).toBe(
      '/example-logo.svg',
    )
  })
})
