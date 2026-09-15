import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { bulkMarkInvoicesPaid, capturedProps } = vi.hoisted(() => ({
  bulkMarkInvoicesPaid: vi.fn(),
  capturedProps: { current: null as unknown },
}))

vi.mock('./actions', () => ({ bulkMarkInvoicesPaid }))
vi.mock('@/components/layout/list-page', () => ({
  ListPage: (props: unknown) => {
    capturedProps.current = props
    return null
  },
}))

import { InvoicesList } from './invoices-list'

describe('InvoicesList', () => {
  it('runs the invoice bulk payment server action from the client boundary', async () => {
    bulkMarkInvoicesPaid.mockResolvedValue({ ok: true })

    render(<InvoicesList title="Facturas" empty="Sin facturas" headers={[]} rows={[]} />)

    const props = capturedProps.current as {
      bulkActions: Array<{ onAction: (ids: string[]) => Promise<void> }>
    }
    await props.bulkActions[0]?.onAction(['invoice-1'])

    expect(bulkMarkInvoicesPaid).toHaveBeenCalledWith({ ids: ['invoice-1'] })
  })
})