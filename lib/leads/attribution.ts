const CYA_PROSP_SOFTWARE_CAMPAIGN = 'CYA - PROSP SOFTWARE'

/** True when a Meta campaign is subject to CYA's agreed referral commission. */
export function requiresCyaProspectSoftwareCommission(campaignName: string | null): boolean {
  return (
    campaignName?.trim().toLocaleLowerCase('es-ES') ===
    CYA_PROSP_SOFTWARE_CAMPAIGN.toLocaleLowerCase('es-ES')
  )
}
