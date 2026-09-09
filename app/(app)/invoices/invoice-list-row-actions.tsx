'use client'

import { Ellipsis as MoreHorizontal, Mail, SquareArrowOutUpRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { SendInvoiceButton } from './[id]/send-invoice-button'

type Props = {
  invoiceId: string
  canSendToClient: boolean
}

/** Keeps client delivery available from the list without crowding its columns. */
export function InvoiceListRowActions({ invoiceId, canSendToClient }: Props) {
  const router = useRouter()
  const [sendDialogOpen, setSendDialogOpen] = useState(false)

  return (
    <div className="flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Más acciones de factura"
            title="Más acciones"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/invoices/${invoiceId}`)}>
            <SquareArrowOutUpRight className="size-4" /> Abrir detalle
          </DropdownMenuItem>
          {canSendToClient ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSendDialogOpen(true)}>
                <Mail className="size-4" /> Enviar o reenviar al cliente
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canSendToClient ? (
        <SendInvoiceButton
          invoiceId={invoiceId}
          hideTrigger
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
        />
      ) : null}
    </div>
  )
}