'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@doscientos/ui'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  LEAD_SALE_PRODUCTS,
  type LeadSaleProduct,
  parseLeadSaleProduct,
} from '@/lib/leads/sale-products'

export function WonProductDialog({
  name,
  product = null,
  editing = false,
  onCancel,
  onConfirm,
}: {
  name: string
  product?: LeadSaleProduct | null
  editing?: boolean
  onCancel: () => void
  onConfirm: (product: LeadSaleProduct | null) => void
}) {
  const id = useId()
  const [selected, setSelected] = useState(product)

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Cambiar producto vendido' : 'Marcar como ganado'}</DialogTitle>
          <DialogDescription>
            Clasifica la venta de {name}. Esto no genera cobros ni facturas.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onConfirm(selected)
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={id} className="text-sm font-medium">
              Producto vendido
            </label>
            <Select
              id={id}
              value={selected ?? ''}
              onChange={(event) => setSelected(parseLeadSaleProduct(event.target.value))}
            >
              <option value="">Sin producto asignado</option>
              {LEAD_SALE_PRODUCTS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" size="sm">
              {editing ? 'Guardar producto' : 'Marcar como ganado'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
