export type MarketingLeadRow = {
  id: string;
  utm_content: string | null;
  status: string | null;
  estimated_value: number | null;
};

export type MarketingCustomerRow = {
  id: string;
  lead_id: string | null;
};

export type MarketingInvoiceRow = {
  client_id: string;
  total: number | null;
};

export type AdCommercialPerformance = {
  crmLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  lostLeads: number;
  customers: number;
  wonValue: number;
  invoicedRevenue: number;
};

export function isMetaAttributedLead(input: {
  external_source: string | null;
  utm_source: string | null;
}): boolean {
  return (
    input.external_source === "Anuncios Meta" ||
    input.utm_source === "facebook" ||
    input.utm_source === "instagram" ||
    input.utm_source === "paid_social"
  );
}

const QUALIFIED_STATUSES = new Set(["contacted", "in_conversation", "qualifying", "quoted", "won"]);
const LOST_STATUSES = new Set(["lost", "not_interested"]);

export function emptyAdCommercialPerformance(): AdCommercialPerformance {
  return {
    crmLeads: 0,
    qualifiedLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    customers: 0,
    wonValue: 0,
    invoicedRevenue: 0,
  };
}

/**
 * Joins CRM outcomes to Meta ads through the stable `utm_content = ad_id`
 * contract. Keeping this pure makes the attribution rules testable without a
 * database and reusable for both the ads and campaigns reports.
 */
export function buildAdCommercialPerformance(
  adIds: string[],
  leads: MarketingLeadRow[],
  customers: MarketingCustomerRow[],
  invoices: MarketingInvoiceRow[],
): Map<string, AdCommercialPerformance> {
  const result = new Map(adIds.map((id) => [id, emptyAdCommercialPerformance()]));
  const leadToAd = new Map<string, string>();

  for (const lead of leads) {
    if (!lead.utm_content || !result.has(lead.utm_content)) continue;
    const performance = result.get(lead.utm_content);
    if (!performance) continue;

    leadToAd.set(lead.id, lead.utm_content);
    performance.crmLeads += 1;
    if (lead.status && QUALIFIED_STATUSES.has(lead.status)) performance.qualifiedLeads += 1;
    if (lead.status === "won") {
      performance.wonLeads += 1;
      performance.wonValue += Number(lead.estimated_value ?? 0);
    }
    if (lead.status && LOST_STATUSES.has(lead.status)) performance.lostLeads += 1;
  }

  const clientToAd = new Map<string, string>();
  const seenCustomerIds = new Set<string>();
  for (const customer of customers) {
    if (seenCustomerIds.has(customer.id)) continue;
    const adId = customer.lead_id ? leadToAd.get(customer.lead_id) : undefined;
    if (!adId) continue;
    seenCustomerIds.add(customer.id);
    clientToAd.set(customer.id, adId);
    const performance = result.get(adId);
    if (performance) performance.customers += 1;
  }

  for (const invoice of invoices) {
    const adId = clientToAd.get(invoice.client_id);
    if (!adId) continue;
    const performance = result.get(adId);
    if (performance) performance.invoicedRevenue += Number(invoice.total ?? 0);
  }

  return result;
}

export function mergeAdCommercialPerformance(
  current: AdCommercialPerformance,
  next: AdCommercialPerformance,
): AdCommercialPerformance {
  return {
    crmLeads: current.crmLeads + next.crmLeads,
    qualifiedLeads: current.qualifiedLeads + next.qualifiedLeads,
    wonLeads: current.wonLeads + next.wonLeads,
    lostLeads: current.lostLeads + next.lostLeads,
    customers: current.customers + next.customers,
    wonValue: current.wonValue + next.wonValue,
    invoicedRevenue: current.invoicedRevenue + next.invoicedRevenue,
  };
}
