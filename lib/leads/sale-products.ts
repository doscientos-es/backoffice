/** Products that can be selected when closing a sale. Services can stay unclassified. */
export const LEAD_SALE_PRODUCTS = [{ value: 'abaco', label: 'Ábaco' }] as const

export type LeadSaleProduct = (typeof LEAD_SALE_PRODUCTS)[number]['value']

export function parseLeadSaleProduct(value: unknown): LeadSaleProduct | null {
  return LEAD_SALE_PRODUCTS.find((product) => product.value === value)?.value ?? null
}

export function leadSaleProductLabel(value: unknown): string | null {
  return LEAD_SALE_PRODUCTS.find((product) => product.value === value)?.label ?? null
}
