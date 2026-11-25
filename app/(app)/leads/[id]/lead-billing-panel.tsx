import { ClientEditDialog } from '@/app/(app)/clients/[id]/client-edit-dialog'
import { FiscalVerificationCard } from '@/app/(app)/clients/[id]/fiscal-verification-card'
import type { ClientFormDefaults } from '@/app/(app)/clients/client-form-fields'
import { DetailGrid, DetailRow } from '@/components/layout/detail-grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatAddress } from '@/lib/address'
import type { ClientDetailResult } from '@/lib/clients/types'

import { LeadBillingCreateDialog } from './lead-billing-create-dialog'

type Client = NonNullable<ClientDetailResult>['client']

export function LeadBillingPanel({
  leadId,
  client,
  linkedClientId,
  canEdit,
  defaults = {},
}: {
  leadId: string
  client: Client | null
  linkedClientId: string | null
  canEdit: boolean
  defaults?: ClientFormDefaults
}) {
  if (!client) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Datos de facturación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {linkedClientId
              ? 'No se han podido cargar los datos de facturación vinculados.'
              : 'Este lead todavía no tiene datos de facturación vinculados.'}
          </p>
          {!linkedClientId && canEdit ? (
            <LeadBillingCreateDialog leadId={leadId} defaults={defaults} />
          ) : null}
        </CardContent>
      </Card>
    )
  }

  const address = formatAddress({
    street: client.billing_address_street,
    zip: client.billing_address_zip,
    city: client.billing_address_city,
    province: client.billing_address_province,
    country: client.billing_address_country,
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Datos de facturación</CardTitle>
        {canEdit ? <ClientEditDialog client={client} billingMode /> : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <DetailGrid>
          <DetailRow label="Razón social">{client.name}</DetailRow>
          <DetailRow label="NIF / CIF">{client.nif || '—'}</DetailRow>
          <DetailRow label="Email">{client.email || '—'}</DetailRow>
          <DetailRow label="Teléfono">{client.phone || '—'}</DetailRow>
          <DetailRow label="Contacto">{client.contact_person || '—'}</DetailRow>
          <DetailRow label="Dirección">{address || '—'}</DetailRow>
        </DetailGrid>
        <FiscalVerificationCard
          clientId={client.id}
          initialStatus={client.fiscal_verification_status}
          initialVerifiedAt={client.fiscal_verified_at}
          canValidate={canEdit}
        />
      </CardContent>
    </Card>
  )
}
