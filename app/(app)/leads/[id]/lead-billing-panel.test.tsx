import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { updateClient, refresh } = vi.hoisted(() => ({ updateClient: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/app/(app)/clients/actions', () => ({ updateClient }))
vi.mock('@/app/(app)/clients/[id]/fiscal-verification-card', () => ({
  FiscalVerificationCard: ({
    clientId,
    canValidate,
  }: {
    clientId: string
    canValidate: boolean
  }) => <p>{canValidate ? `Validar ${clientId}` : 'Solo lectura'}</p>,
}))
vi.mock('./lead-billing-create-dialog', () => ({
  LeadBillingCreateDialog: ({ leadId }: { leadId: string }) => (
    <button type="button">Añadir facturación {leadId}</button>
  ),
}))

import { LeadBillingPanel } from './lead-billing-panel'

const client = {
  id: 'client-1',
  version: 1,
  name: 'Ejemplo SL',
  label: null,
  nif: 'B12345678',
  email: 'facturacion@example.com',
  phone: null,
  contact_person: null,
  billing_address_street: 'Calle Mayor 1',
  billing_address_zip: null,
  billing_address_city: null,
  billing_address_province: null,
  billing_address_country: 'ES',
  notes: null,
  logo_url: null,
  fiscal_verification_status: 'unverified' as const,
  fiscal_verified_at: null,
  created_at: null,
  updated_at: null,
}

describe('LeadBillingPanel', () => {
  it('shows and edits the existing billing identity and verifies the linked client', () => {
    render(<LeadBillingPanel leadId="lead-1" linkedClientId="client-1" client={client} canEdit />)
    expect(screen.getByText('Ejemplo SL')).toBeDefined()
    expect(screen.getByText('B12345678')).toBeDefined()
    expect(screen.getByText(/Calle Mayor 1/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeDefined()
    expect(screen.getByText('Validar client-1')).toBeDefined()
  })

  it('enables saving and submits the linked billing record when only its logo changes', async () => {
    const logoUrl = 'https://example.test/logo.png'
    updateClient.mockResolvedValue({ ok: true, version: 2 })
    render(<LeadBillingPanel leadId="lead-1" linkedClientId="client-1" client={client} canEdit />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Editar datos de facturación' }))
    const save = dialog.getByRole('button', { name: 'Guardar cambios' })
    expect(save).toHaveProperty('disabled', true)
    fireEvent.change(dialog.getByPlaceholderText('https://empresa.com/logo.png'), {
      target: { value: logoUrl },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Usar URL' }))
    expect(save).toHaveProperty('disabled', false)
    fireEvent.click(save)

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(updateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        id: client.id,
        expected_version: client.version,
        logo_url: logoUrl,
        nif: client.nif,
      }),
    )
  })

  it('does not offer editing or fiscal validation to viewers', () => {
    render(
      <LeadBillingPanel
        leadId="lead-1"
        linkedClientId="client-1"
        client={client}
        canEdit={false}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.getByText('Solo lectura')).toBeDefined()
  })

  it('does not mistake a failed lookup for a lead without a linked client', () => {
    render(<LeadBillingPanel leadId="lead-1" linkedClientId="client-1" client={null} canEdit />)
    expect(screen.getByText(/No se han podido cargar/)).toBeDefined()
    expect(screen.queryByRole('button', { name: /Añadir facturación/ })).toBeNull()
  })

  it('offers billing data without converting the lead into a won client', () => {
    render(<LeadBillingPanel leadId="lead-1" linkedClientId={null} client={null} canEdit />)
    expect(screen.getByRole('button', { name: 'Añadir facturación lead-1' })).toBeDefined()
  })

  it('does not let viewers create billing data', () => {
    render(<LeadBillingPanel leadId="lead-1" linkedClientId={null} client={null} canEdit={false} />)
    expect(screen.queryByRole('button', { name: /Añadir facturación/ })).toBeNull()
  })

  it('does not offer billing creation when the linked client is not visible', () => {
    render(
      <LeadBillingPanel
        leadId="lead-1"
        linkedClientId={null}
        client={null}
        canEdit
        canRead={false}
      />,
    )
    expect(screen.getByText('No tienes acceso a los datos de facturación.')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Añadir facturación/ })).toBeNull()
  })
})
