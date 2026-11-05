import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/lib/marketing/email-marketing', () => ({
  getEmailMarketingListContacts: vi.fn(async () => ({
    contacts: [
      {
        id: 'contact-1',
        email: 'ana@example.test',
        name: 'Ana',
        company: 'Acme',
        status: 'unsubscribed',
        unsubscribe_token: '123e4567-e89b-42d3-a456-426614174000',
      },
    ],
    count: 51,
    pageSize: 50,
  })),
}))
vi.mock('./list-dialogs', () => ({
  CreateListDialog: () => null,
  CreateSequenceDialog: () => null,
  DeleteListDialog: () => null,
  ImportContactsDialog: () => null,
}))
vi.mock('./manage-dialogs', () => ({
  EditMarketingDialog: () => null,
  RemoveContactDialog: () => null,
}))

import type { EmailMarketingList, EmailMarketingSequence } from '@/lib/marketing/email-marketing'

import { MarketingWorkspace } from './workspace'

const list: EmailMarketingList = {
  id: 'list-1',
  name: 'Clientes',
  description: null,
  contact_count: 1,
  created_at: '',
}
const sequence: EmailMarketingSequence = {
  id: 'sequence-1',
  list_id: list.id,
  list_name: list.name,
  name: 'Bienvenida',
  status: 'paused',
  created_at: '',
  steps: [],
}

describe('navegación de email marketing', () => {
  it('muestra listas enlazadas y sus secuencias en el resumen', async () => {
    render(
      await MarketingWorkspace({
        lists: [list],
        sequences: [sequence],
        page: 1,
        appUrl: 'https://example.test',
      }),
    )
    expect(screen.getByRole('link', { name: /Clientes/ }).getAttribute('href')).toBe(
      '/marketing/newsletters?list=list-1',
    )
    expect(screen.getByText('1 secuencia')).toBeTruthy()
  })

  it('muestra las secuencias, estado de los contactos y paginación dentro de una lista', async () => {
    render(
      await MarketingWorkspace({
        lists: [list],
        sequences: [sequence],
        list,
        page: 1,
        appUrl: 'https://example.test',
      }),
    )
    expect(screen.getByRole('link', { name: /Bienvenida/ }).getAttribute('href')).toBe(
      '/marketing/newsletters?list=list-1&sequence=sequence-1',
    )
    expect(screen.getByText('Baja')).toBeTruthy()
    expect(screen.getByText(/ana@example.test/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Siguiente' }).getAttribute('href')).toBe(
      '/marketing/newsletters?list=list-1&page=2',
    )
  })

  it('copia un enlace personalizado con la URL pública configurada', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    try {
      render(
        await MarketingWorkspace({
          lists: [list],
          sequences: [sequence],
          list,
          page: 1,
          appUrl: 'https://example.test',
        }),
      )
      fireEvent.click(screen.getByRole('button', { name: /Copiar enlace de baja/ }))
      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(
          'https://example.test/api/track/unsubscribe/123e4567-e89b-42d3-a456-426614174000',
        ),
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
