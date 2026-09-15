'use client'

import { CheckCircle2 } from 'lucide-react'

import { ListPage, type ListPageProps } from '@/components/layout/list-page'

import { bulkMarkInvoicesPaid } from './actions'

type InvoicesListProps = Omit<ListPageProps, 'bulkActions'>

export function InvoicesList(props: InvoicesListProps) {
  return (
    <ListPage
      {...props}
      bulkActions={[
        {
          label: 'Marcar cobradas · transferencia',
          icon: CheckCircle2,
          onAction: async (ids) => {
            const result = await bulkMarkInvoicesPaid({ ids })
            if (!result.ok) throw new Error(result.error)
          },
        },
      ]}
    />
  )
}