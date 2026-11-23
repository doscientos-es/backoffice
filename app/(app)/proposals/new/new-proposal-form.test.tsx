import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('../actions', () => ({ createProposalAction: vi.fn() }))
vi.mock('@/components/ui/entity-combobox', () => ({
  EntityCombobox: ({
    id,
    items,
    value,
    onChange,
  }: {
    id: string
    items: Array<{ id: string; label: string }>
    value: string
    onChange: (value: string) => void
  }) => (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Seleccionar</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}))

import { createProposalAction } from '../actions'
import { NewProposalForm } from './new-proposal-form'

const leadId = '494d62cb-fd56-4650-b131-9e3a927a20ad'
const proposalId = 'f4e5d6c7-b8a9-4012-8012-123456789abc'
const props = {
  clients: [],
  leads: [{ id: leadId, name: 'Ejemplo', company: null, status: 'open' }],
  projects: [],
  aiEnabled: true,
}
const create = vi.mocked(createProposalAction)

describe('NewProposalForm', () => {
  beforeEach(() => {
    create.mockReset()
    push.mockReset()
    create.mockResolvedValue({ ok: true, id: proposalId })
  })

  it('asks for a recipient, including when a preselected lead is no longer available', () => {
    render(<NewProposalForm {...props} initialLeadId={proposalId} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    expect(screen.getByText('Selecciona el destinatario de la propuesta')).toBeDefined()
    expect(create).not.toHaveBeenCalled()
  })

  it('creates an editable draft with an explicit placeholder if no items were entered', async () => {
    render(<NewProposalForm {...props} initialLeadId={leadId} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Propuesta para Ejemplo',
          items: [expect.objectContaining({ description: 'Pendiente de definir' })],
        }),
      ),
    )
    expect(push).toHaveBeenCalledWith(`/proposals/${proposalId}?mode=edit`)
  })

  it('does not silently discard incomplete lines and preserves discounts on retry', async () => {
    render(<NewProposalForm {...props} initialLeadId={leadId} />)
    fireEvent.click(screen.getByText(/Añadir partidas iniciales/))
    fireEvent.change(screen.getByLabelText('Descripción línea 1'), { target: { value: 'Diseño' } })
    fireEvent.change(screen.getByLabelText('Precio unitario línea 1'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Descuento línea 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Motivo del descuento línea 1'), {
      target: { value: 'Acuerdo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir concepto' }))
    fireEvent.change(screen.getByLabelText('Precio unitario línea 2'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    expect(screen.getByText(/Línea 2 · Descripción/)).toBeDefined()
    expect(create).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Descripción línea 2'), {
      target: { value: ' Desarrollo ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({ discount_percent: 10, discount_reason: 'Acuerdo' }),
            expect.objectContaining({ description: 'Desarrollo', unit_price: 50 }),
          ],
        }),
      ),
    )
  })

  it('validates the demo URL before either creation mode', () => {
    render(<NewProposalForm {...props} initialLeadId={leadId} />)
    fireEvent.click(screen.getByText(/Más detalles/))
    fireEvent.change(screen.getByLabelText('Enlace de la demo'), {
      target: { value: 'ftp://example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear y prerrellenar con IA' }))
    expect(
      screen.getByText(/Enlace de la demo: Introduce una URL HTTP o HTTPS válida/),
    ).toBeDefined()
    expect(create).not.toHaveBeenCalled()
  })

  it('starts the AI draft with the selected lead', async () => {
    render(<NewProposalForm {...props} initialLeadId={leadId} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear y prerrellenar con IA' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/proposals/${proposalId}?ai_draft=1`))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ lead_id: leadId }))
  })

  it('allows retry after a confirmed failure without losing the title', async () => {
    create.mockResolvedValueOnce({ ok: false, error: 'No se pudo crear' })
    render(<NewProposalForm {...props} initialLeadId={leadId} />)
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Borrador' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    expect(await screen.findByText('No se pudo crear')).toBeDefined()
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Crear borrador' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    await waitFor(() =>
      expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Borrador' })),
    )
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('offers recovery rather than creating a duplicate after partial creation', async () => {
    create.mockResolvedValue({ ok: false, id: proposalId, error: 'No se guardaron las partidas' })
    render(<NewProposalForm {...props} initialLeadId={leadId} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    expect(
      (await screen.findByRole('link', { name: 'Abrir borrador creado' })).getAttribute('href'),
    ).toBe(`/proposals/${proposalId}?mode=edit`)
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Crear borrador' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    )
  })

  it('keeps input and asks to check the list if the request fails unexpectedly', async () => {
    create.mockRejectedValue(new Error('connection lost'))
    render(<NewProposalForm {...props} initialLeadId={leadId} />)
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi propuesta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    expect(await screen.findByText(/No se pudo confirmar la creación/)).toBeDefined()
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Mi propuesta')
    expect(screen.getByRole('link', { name: 'Revisar propuestas' })).toBeDefined()
  })

  it('keeps an invalid date visible and prevents creation until it is corrected', async () => {
    render(<NewProposalForm {...props} initialLeadId={leadId} />)
    const date = screen.getByLabelText('Válida hasta') as HTMLInputElement
    fireEvent.change(date, { target: { value: '31/02/2028' } })
    fireEvent.blur(date)
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    expect(screen.getByText(/Fecha de validez: introduce una fecha válida/)).toBeDefined()
    expect(date.value).toBe('31/02/2028')
    expect(create).not.toHaveBeenCalled()
    fireEvent.change(date, { target: { value: '28/02/2028' } })
    fireEvent.blur(date)
    fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ valid_until: '2028-02-28' })),
    )
  })

  it('uses a valid typed date even when submitted without blurring', async () => {
    render(<NewProposalForm {...props} initialLeadId={leadId} />)
    const date = screen.getByLabelText('Válida hasta')
    fireEvent.change(date, { target: { value: '28/02/2028' } })
    fireEvent.submit(date.closest('form')!)
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ valid_until: '2028-02-28' })),
    )
  })
})
