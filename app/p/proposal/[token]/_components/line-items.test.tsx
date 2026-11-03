import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeTr } from '../_lib/i18n'
import type { ProposalItem } from '../_lib/types'
import { LineItems } from './line-items'

afterEach(cleanup)

const item: ProposalItem = {
  id: 'line-1',
  description: 'Servicio',
  quantity: 1,
  unit_price: 100,
  vat_rate: 21,
  subtotal: 100,
  billing_cycle: 'none',
}

function renderItems(items: ProposalItem[]) {
  const result = render(
    <LineItems items={items} hasRecurring={false} language="es" tr={makeTr('es')} />,
  )
  return {
    ...result,
    table: result.container.querySelector('table')!,
    list: result.container.querySelector('ul')!,
  }
}

describe('LineItems', () => {
  it('hides the duplicate unit-price column when all quantities are one without discounts', () => {
    const { table, list } = renderItems([item])
    expect(within(table).queryByText('Precio unitario')).toBeNull()
    expect(within(table).getByText('Subtotal')).toBeDefined()
    expect(within(table).getAllByText(/^100,00/)).toHaveLength(1)
    expect(within(list).getAllByText(/^100,00/)).toHaveLength(1)
    expect(within(list).queryByText(/1 ×/)).toBeNull()
  })

  it('keeps unit prices when a quantity differs from one', () => {
    const { table, list } = renderItems([
      item,
      { ...item, id: 'line-2', quantity: 2, subtotal: 200 },
    ])
    expect(within(table).getByText('Precio unitario')).toBeDefined()
    expect(within(table).getByText(/^200,00/)).toBeDefined()
    expect(within(list).getByText(/2 × 100,00/)).toBeDefined()
  })

  it('keeps the original unit price and the discounted subtotal for discounted lines', () => {
    const { table, list } = renderItems([
      { ...item, discount_percent: 20, discount_reason: 'Oferta' },
    ])
    expect(within(table).getByText('Precio unitario')).toBeDefined()
    expect(within(table).getByText(/^80,00/)).toBeDefined()
    expect(within(table).getByText(/−20% · Oferta/)).toBeDefined()
    expect(within(list).getByText(/1 × 100,00/)).toBeDefined()
    expect(within(list).getByText(/^80,00/)).toBeDefined()
  })
})
