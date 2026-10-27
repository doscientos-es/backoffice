import { formatAddress } from '@/lib/address'
import { createAdminClient } from '@/lib/supabase/admin'

import { type NdaDocument, buildNda } from './clauses'

export type LoadedNda = {
  id: string
  status: 'pending' | 'signed' | 'void'
  signedAt: string | null
  signedName: string | null
  document: NdaDocument
}

/** Loads an NDA by its public token (service role) and builds its text. */
export async function loadNdaByToken(token: string): Promise<LoadedNda | null> {
  const admin = createAdminClient()
  const [{ data: nda }, { data: settings }] = await Promise.all([
    admin
      .from('lead_ndas')
      .select(
        'id, status, signed_at, signed_name, counterparty_name, counterparty_nif, counterparty_address, representative_name, purpose, confidentiality_years, effective_date',
      )
      .eq('portal_token', token)
      .is('deleted_at', null)
      .maybeSingle(),
    admin
      .from('settings')
      .select(
        'company_name, company_nif, company_address_street, company_address_zip, company_address_city, company_address_province, company_address_country',
      )
      .eq('id', 1)
      .maybeSingle(),
  ])
  if (!nda || nda.status === 'void') return null

  return {
    id: nda.id as string,
    status: nda.status as LoadedNda['status'],
    signedAt: (nda.signed_at as string | null) ?? null,
    signedName: (nda.signed_name as string | null) ?? null,
    document: buildNda({
      disclosing: {
        name: (settings?.company_name as string | null) ?? 'doscientos',
        nif: settings?.company_nif as string | null,
        address: settings
          ? formatAddress({
              street: settings.company_address_street,
              zip: settings.company_address_zip,
              city: settings.company_address_city,
              province: settings.company_address_province,
              country: settings.company_address_country,
            })
          : null,
      },
      counterparty: {
        name: nda.counterparty_name as string,
        nif: nda.counterparty_nif as string | null,
        address: nda.counterparty_address as string | null,
        representative: nda.representative_name as string | null,
      },
      purpose: nda.purpose as string,
      confidentialityYears: Number(nda.confidentiality_years),
      effectiveDate: nda.effective_date as string,
    }),
  }
}
