import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { recordInvoicePayment } from '../actions'
import { InvoicePaymentActions } from './invoice-payment-actions'

vi.mock('../actions', () => ({
  recordInvoicePayment: vi.fn(),
  updateInvoiceStatus: vi.fn(),
}))

describe('InvoicePaymentActions', () => {
  it('submits the outstanding amount as a direct debit when selected', async () => {
    vi.mocked(recordInvoicePayment).mockResolvedValue({ ok: true, fullyPaid: true })
    const onChanged = vi.fn()

    render(
      <InvoicePaymentActions
        invoiceId="invoice-1"
        total={100}
        amountPaid={25}
        canRecordPayment
        canRevertPayment={false}
        feedback={{ setPending: vi.fn(), setSuccess: vi.fn(), setError: vi.fn() }}
        verifyStatusChange={vi.fn()}
        onChanged={onChanged}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Registrar cobro' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Registrar cobro' }))
    fireEvent.click(dialog.getByRole('radio', { name: 'Adeudo bancario' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Registrar cobro' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
    expect(recordInvoicePayment).toHaveBeenCalledWith({
      id: 'invoice-1',
      amount: 75,
      paymentMethod: 'direct_debit',
    })
  })
})
