import {
  Document,
  Font,
  Link,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

import type { KeyPoint } from '@/lib/proposals/key-points'
import type { MaintenanceOffer } from '@/lib/proposals/maintenance'
import {
  PAYMENT_SCHEDULE_LABELS,
  type PaymentSchedule,
  paymentInitialPercentage,
  type ScopeModule,
  scopeModuleDurationText,
} from '@/lib/proposals/scope'

const BRAND = '#2A4227'
const INK = '#183017'
const ACCENT = '#BDFF7B'
const PAPER = '#FAFAF7'
const MIST = '#E9F1E6'
const MUTED = '#657067'

Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  cover: { backgroundColor: BRAND, color: '#FFFFFF', fontFamily: 'Helvetica', padding: 48 },
  page: {
    backgroundColor: PAPER,
    color: INK,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    paddingBottom: 60,
    paddingHorizontal: 48,
    paddingTop: 82,
  },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 1.2 },
  brandLight: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 1.2 },
  coverHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  coverTag: {
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  coverHero: { marginTop: 104 },
  eyebrow: {
    color: ACCENT,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  coverTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 31,
    lineHeight: 1.08,
    marginTop: 13,
    maxWidth: 420,
  },
  coverRecipient: { color: '#DDE9DB', fontSize: 12, lineHeight: 1.45, marginTop: 16 },
  metricCard: { backgroundColor: '#355332', borderRadius: 16, marginTop: 50, padding: 21 },
  metricLabel: {
    color: '#DDE9DB',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  metricValue: { color: ACCENT, fontFamily: 'Helvetica-Bold', fontSize: 30, marginTop: 7 },
  metricText: { color: '#DDE9DB', fontSize: 9, lineHeight: 1.4, marginTop: 6 },
  coverFooter: {
    bottom: 45,
    color: '#DDE9DB',
    fontSize: 8,
    left: 48,
    position: 'absolute',
    right: 48,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 48,
    position: 'absolute',
    right: 48,
    top: 35,
  },
  pageLabel: { color: MUTED, fontSize: 8 },
  section: { marginTop: 24 },
  sectionLabel: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
  },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 18, lineHeight: 1.18, marginTop: 7 },
  body: { color: MUTED, fontSize: 9.5, lineHeight: 1.55, marginTop: 10 },
  point: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E1D7',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 9,
    padding: 12,
  },
  pointTitle: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  pointText: { color: MUTED, fontSize: 8.5, lineHeight: 1.45, marginTop: 4 },
  maintenanceTable: {
    borderColor: '#D9E1D7',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 13,
    overflow: 'hidden',
  },
  maintenanceRow: {
    borderTopColor: '#E5EAE3',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  maintenancePlanName: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  maintenanceSelection: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  maintenanceSummary: { color: MUTED, fontSize: 8, lineHeight: 1.4, marginTop: 3 },
  maintenanceListLabel: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.5,
    marginTop: 7,
    textTransform: 'uppercase',
  },
  maintenanceList: { color: MUTED, fontSize: 7.5, lineHeight: 1.4, marginTop: 2 },
  maintenancePrice: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textAlign: 'right',
  },
  maintenanceVat: { color: MUTED, fontSize: 7.5, marginTop: 2, textAlign: 'right' },
  investment: { backgroundColor: BRAND, borderRadius: 14, marginTop: 13, padding: 18 },
  investmentLabel: {
    color: ACCENT,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  investmentValue: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 23, marginTop: 6 },
  investmentText: { color: '#DDE9DB', fontSize: 8.5, marginTop: 5 },
  table: {
    borderColor: '#D9E1D7',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 13,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: MIST,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  tableHeaderText: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    borderTopColor: '#E5EAE3',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  itemDescription: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },
  itemMeta: { color: MUTED, fontSize: 7.5, marginTop: 3 },
  amount: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: 'right' },
  totalRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  totalLabel: { color: MUTED, fontSize: 8.5, marginRight: 12 },
  totalValue: { color: MUTED, fontSize: 9 },
  footer: { bottom: 25, color: MUTED, fontSize: 7.5, left: 48, position: 'absolute', right: 48 },
  footerLine: { borderTopColor: '#D9E1D7', borderTopWidth: 1, paddingTop: 8 },
  bullet: { color: MUTED, fontSize: 8.5, lineHeight: 1.45, marginTop: 3 },
  cta: { backgroundColor: BRAND, borderRadius: 10, marginTop: 20, padding: 15 },
  ctaText: { color: '#DDE9DB', fontSize: 8.5, lineHeight: 1.45 },
  ctaLink: { color: ACCENT, fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 7 },
  acceptance: { borderColor: BRAND, borderRadius: 10, borderWidth: 1, marginTop: 20, padding: 16 },
  acceptanceHash: { color: MUTED, fontSize: 6.5, lineHeight: 1.35, marginTop: 8 },
  legalClause: { marginBottom: 8 },
  legalTitle: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 8, lineHeight: 1.3 },
  legalBody: { color: MUTED, fontSize: 7.5, lineHeight: 1.35, marginTop: 2 },
})

export type ProposalPdfItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  subtotal: number
  billingCycle: string | null
}

export type ProposalPdfData = {
  language?: 'es' | 'ca' | 'en'
  number: string | null
  title: string
  recipientName: string
  recipientNif?: string | null
  recipientAddress?: string | null
  validUntil: string | null
  context: string | null
  problems: KeyPoint[]
  solutions: KeyPoint[]
  scopeModules: ScopeModule[]
  deliverables: string | null
  acceptanceCriteria: string | null
  paymentSchedule: PaymentSchedule
  paymentTerms: string | null
  changeManagementTerms: string | null
  legalTerms: string
  notes: string | null
  subtotal: number
  taxAmount: number
  total: number
  items: ProposalPdfItem[]
  maintenanceOffer: MaintenanceOffer
  maintenanceSelectedPlanId: string | null
  portalUrl: string
  companyName: string | null
  companyNif?: string | null
  companyAddress?: string | null
  iban: string | null
  acceptance?: {
    signerName: string
    signerRole: string | null
    acceptedAt: string
    documentHash: string
    consentText?: string | null
    clientCapacity?: 'business' | 'consumer' | null
    consumerEarlyStartRequested?: boolean
  } | null
  acceptedWithoutSignature?: boolean
}

function money(value: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
}

function date(value: string | null): string | null {
  if (!value) return null
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(value))
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function cycleLabel(cycle: string | null, language: 'es' | 'ca' | 'en'): string {
  const labels =
    language === 'ca'
      ? { monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual', once: 'Únic' }
      : language === 'en'
        ? { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly', once: 'One-time' }
        : { monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual', once: 'Único' }
  return labels[cycle as 'monthly' | 'quarterly' | 'yearly'] ?? labels.once
}

export function proposalPdfFilename(number: string | null, id: string): string {
  const reference = number?.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || id
  return `propuesta-${reference}.pdf`
}

export function printableMarkdown(value: string | null): string {
  return (value ?? '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function Footer({ language }: { language: 'es' | 'ca' | 'en' }) {
  const label =
    language === 'ca'
      ? 'Proposta confidencial'
      : language === 'en'
        ? 'Confidential proposal'
        : 'Propuesta confidencial'
  return (
    <View fixed style={styles.footer}>
      <Text style={styles.footerLine}>doscientos · {label}</Text>
    </View>
  )
}

function PointList({ points }: { points: KeyPoint[] }) {
  return (
    <>
      {points.map((point) => (
        <View key={point.id} style={styles.point} wrap={false}>
          <Text style={styles.pointTitle}>{point.title}</Text>
          {point.description ? (
            <Text style={styles.pointText}>{printableMarkdown(point.description)}</Text>
          ) : null}
        </View>
      ))}
    </>
  )
}

function ScopeModuleList({ modules }: { modules: ScopeModule[] }) {
  return (
    <>
      {modules.map((module, index) => (
        <View key={module.id} style={styles.point} wrap={false}>
          <Text
            style={styles.pointTitle}
          >{`${String(index + 1).padStart(2, '0')} · ${module.title}`}</Text>
          {module.description ? <Text style={styles.pointText}>{module.description}</Text> : null}
          {scopeModuleDurationText(module) ? (
            <Text
              style={styles.pointText}
            >{`Plazo estimado: ${scopeModuleDurationText(module)}`}</Text>
          ) : null}
          {module.included.length > 0 ? (
            <Text style={[styles.pointText, { color: BRAND, fontFamily: 'Helvetica-Bold' }]}>
              Incluido
            </Text>
          ) : null}
          {module.included.map((item) => (
            <Text key={`included-${item}`} style={styles.bullet}>{`• ${item}`}</Text>
          ))}
          {module.excluded.length > 0 ? (
            <Text style={[styles.pointText, { fontFamily: 'Helvetica-Bold' }]}>No incluido</Text>
          ) : null}
          {module.excluded.map((item) => (
            <Text key={`excluded-${item}`} style={styles.bullet}>{`• ${item}`}</Text>
          ))}
          {module.notes ? <Text style={styles.pointText}>{`Notas: ${module.notes}`}</Text> : null}
        </View>
      ))}
    </>
  )
}

function LegalTerms({ source }: { source: string }) {
  const clauses = source
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
  return (
    <View style={{ marginTop: 10 }}>
      {clauses.map((clause, index) => {
        const match = /^(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)$/s.exec(clause)
        if (!match) {
          return (
            <Text key={`clause-${index}`} style={styles.legalBody}>
              {printableMarkdown(clause)}
            </Text>
          )
        }
        return (
          <View key={`clause-${index}`} style={styles.legalClause} wrap={false}>
            <Text style={styles.legalTitle}>{`${match[1]}. ${match[2]}`}</Text>
            {match[3]?.trim() ? (
              <Text style={styles.legalBody}>{printableMarkdown(match[3])}</Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

function MaintenancePlanList({
  offer,
  selectedPlanId,
}: {
  offer: MaintenanceOffer
  selectedPlanId: string | null
}) {
  return (
    <View style={styles.maintenanceTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { width: '74%' }]}>Cobertura</Text>
        <Text style={[styles.tableHeaderText, { textAlign: 'right', width: '26%' }]}>
          Cuota mensual
        </Text>
      </View>
      {offer.plans.map((plan) => {
        const selected = plan.id === selectedPlanId
        return (
          <View key={plan.id} style={styles.maintenanceRow} wrap={false}>
            <View style={{ width: '74%' }}>
              <Text style={styles.maintenancePlanName}>{plan.name}</Text>
              {selected ? <Text style={styles.maintenanceSelection}>Plan elegido</Text> : null}
              <Text style={styles.maintenanceSummary}>{plan.summary}</Text>
              <Text style={styles.maintenanceListLabel}>Incluye</Text>
              <Text style={styles.maintenanceList}>{plan.coverage.join(' · ')}</Text>
              {plan.exclusions.length > 0 ? (
                <>
                  <Text style={styles.maintenanceListLabel}>No incluye</Text>
                  <Text style={styles.maintenanceList}>{plan.exclusions.join(' · ')}</Text>
                </>
              ) : null}
            </View>
            <View style={{ width: '26%' }}>
              <Text style={styles.maintenancePrice}>{`${money(plan.monthly_price)} / mes`}</Text>
              <Text style={styles.maintenanceVat}>+ IVA</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function ProposalPdfDocument({ data }: { data: ProposalPdfData }) {
  const language = data.language ?? 'es'
  const ca = language === 'ca'
  const en = language === 'en'
  const copy = {
    proposal: ca ? 'Proposta' : en ? 'Proposal' : 'Propuesta',
    custom: ca ? 'personalitzada' : en ? 'custom' : 'personalizada',
    prepared: ca ? 'Preparada per a' : en ? 'Prepared for' : 'Preparada para',
    investment: ca ? 'Inversió inicial' : en ? 'Initial investment' : 'Inversión inicial',
    taxExcluded: ca ? '(IVA no inclòs)' : en ? '(VAT excluded)' : '(IVA no incluido)',
    valid: ca ? 'Vàlida fins al' : en ? 'Valid until' : 'Válida hasta el',
    context: ca ? 'Context' : en ? 'Context' : 'Contexto',
    challenges: ca ? 'Reptes detectats' : en ? 'Challenges identified' : 'Retos detectados',
    proposalScope: ca ? 'Abast del projecte' : en ? 'Project scope' : 'Alcance del proyecto',
    economics: ca ? 'Proposta econòmica' : en ? 'Pricing proposal' : 'Propuesta económica',
    concept: ca ? 'Concepte' : en ? 'Item' : 'Concepto',
    amount: ca ? 'Import' : en ? 'Amount' : 'Importe',
    total: ca
      ? 'Total inicial previst amb IVA'
      : en
        ? 'Estimated initial total incl. VAT'
        : 'Total inicial previsto con IVA',
    payment: ca ? 'Pagament' : en ? 'Payment' : 'Pago',
    notes: ca ? 'Notes' : en ? 'Notes' : 'Notas',
    maintenance: ca ? 'Manteniment' : en ? 'Maintenance' : 'Mantenimiento',
    acceptance: ca
      ? 'Acceptació electrònica'
      : en
        ? 'Electronic acceptance'
        : 'Aceptación electrónica',
    accepted: ca ? 'Proposta acceptada' : en ? 'Proposal accepted' : 'Propuesta aceptada',
    manualAcceptance: ca
      ? 'Acceptació registrada manualment a Doscientos. No consta signatura electrònica del client.'
      : en
        ? 'Acceptance recorded manually in Doscientos. No client electronic signature is recorded.'
        : 'Aceptación registrada manualmente en Doscientos. No consta firma electrónica del cliente.',
    signed: ca
      ? 'Proposta signada i acceptada'
      : en
        ? 'Proposal signed and accepted'
        : 'Propuesta firmada y aceptada',
    annex: ca ? 'Annex contractual' : en ? 'Contractual annex' : 'Anexo contractual',
    terms: ca
      ? 'Condicions generals i particulars'
      : en
        ? 'General and specific terms'
        : 'Condiciones generales y particulares',
    parties: ca ? 'Parts del contracte' : en ? 'Contracting parties' : 'Partes del contrato',
    provider: ca ? 'Prestador' : en ? 'Service provider' : 'Prestador del servicio',
    client: ca ? 'Client' : en ? 'Client' : 'Cliente',
    taxId: ca ? 'NIF' : en ? 'Tax ID' : 'NIF',
    address: ca ? 'Adreça' : en ? 'Address' : 'Domicili',
    capacity: ca ? 'Capacitat del client' : en ? 'Client capacity' : 'Condició del cliente',
    business: ca
      ? 'Empresa o professional'
      : en
        ? 'Business or professional'
        : 'Empresa o profesional',
    consumer: ca ? 'Consumidor' : en ? 'Consumer' : 'Consumidor',
    earlyStart: ca
      ? 'Inici anticipat sol·licitat expressament durant el termini de desistiment.'
      : en
        ? 'Early commencement during the withdrawal period expressly requested.'
        : 'Inicio anticipado durante el plazo de desistimiento solicitado expresamente.',
    standardStart: ca
      ? 'No s’ha sol·licitat l’inici anticipat; els serveis començaran després del termini de desistiment.'
      : en
        ? 'Early commencement was not requested; services begin after the withdrawal period.'
        : 'No se ha solicitado el inicio anticipado; los servicios comenzarán tras el plazo de desistimiento.',
    declaration: ca ? 'Declaració acceptada' : en ? 'Accepted declaration' : 'Declaración aceptada',
  }
  const validUntil = date(data.validUntil)
  const hasRecurring = data.items.some((item) => item.billingCycle && item.billingCycle !== 'none')
  const deliverables = data.deliverables?.trim()
  const acceptanceCriteria = data.acceptanceCriteria?.trim()
  const initialPaymentPercentage = paymentInitialPercentage(data.paymentSchedule)
  const hasConditions = Boolean(data.paymentTerms || data.changeManagementTerms)
  return (
    <Document title={`${copy.proposal} ${data.number ?? ''} · ${data.title}`} author="doscientos">
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverHeader}>
          <Text style={styles.brandLight}>doscientos</Text>
          <Text style={styles.coverTag}>
            {copy.proposal} {data.number ?? copy.custom}
          </Text>
        </View>
        <View style={styles.coverHero}>
          <Text style={styles.eyebrow}>Una propuesta para avanzar</Text>
          <Text style={styles.coverTitle}>{data.title}</Text>
          <Text style={styles.coverRecipient}>
            {copy.prepared} {data.recipientName}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{copy.investment}</Text>
          <Text style={styles.metricValue}>{money(data.subtotal)}</Text>
          <Text style={styles.metricText}>{copy.taxExcluded}</Text>
          {validUntil ? (
            <Text style={styles.metricText}>{`${copy.valid} ${validUntil}.`}</Text>
          ) : null}
        </View>
        <Text style={styles.coverFooter}>
          {ca ? 'Document confidencial' : en ? 'Confidential document' : 'Documento confidencial'} ·
          doscientos.es
        </Text>
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <View fixed style={styles.header}>
          <Text style={styles.brand}>doscientos</Text>
          <Text style={styles.pageLabel}>
            {copy.proposal} {data.number ?? copy.custom}
          </Text>
        </View>

        {data.context ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy.context}</Text>
            <Text style={styles.sectionTitle}>El punto de partida</Text>
            <Text style={styles.body}>{printableMarkdown(data.context)}</Text>
          </View>
        ) : null}

        {data.problems.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy.challenges}</Text>
            <Text style={styles.sectionTitle}>Lo que queremos resolver</Text>
            <PointList points={data.problems} />
          </View>
        ) : null}

        {data.solutions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nuestra propuesta</Text>
            <Text style={styles.sectionTitle}>Cómo lo abordamos</Text>
            <PointList points={data.solutions} />
          </View>
        ) : null}

        {data.scopeModules.length > 0 ? (
          <View
            style={styles.section}
            break={Boolean(data.context || data.problems.length || data.solutions.length)}
          >
            <Text style={styles.sectionLabel}>{copy.proposalScope}</Text>
            <Text style={styles.sectionTitle}>Qué incluye esta propuesta</Text>
            <ScopeModuleList modules={data.scopeModules} />
          </View>
        ) : null}

        {deliverables || acceptanceCriteria ? (
          <View style={styles.section} break={data.scopeModules.length > 0}>
            <Text style={styles.sectionLabel}>Entrega y validación</Text>
            {deliverables ? (
              <>
                <Text style={styles.pointTitle}>Entregables</Text>
                <Text style={styles.body}>{printableMarkdown(deliverables)}</Text>
              </>
            ) : null}
            {acceptanceCriteria ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: 12 }]}>Criterios de aceptación</Text>
                <Text style={styles.body}>{printableMarkdown(acceptanceCriteria)}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{copy.parties}</Text>
          <View style={styles.point}>
            <Text style={styles.pointTitle}>{copy.provider}</Text>
            <Text style={styles.pointText}>
              {[
                data.companyName,
                data.companyNif ? `${copy.taxId}: ${data.companyNif}` : null,
                data.companyAddress ? `${copy.address}: ${data.companyAddress}` : null,
              ]
                .filter(Boolean)
                .join('\n')}
            </Text>
          </View>
          <View style={styles.point}>
            <Text style={styles.pointTitle}>{copy.client}</Text>
            <Text style={styles.pointText}>
              {[
                data.recipientName,
                data.recipientNif ? `${copy.taxId}: ${data.recipientNif}` : null,
                data.recipientAddress ? `${copy.address}: ${data.recipientAddress}` : null,
              ]
                .filter(Boolean)
                .join('\n')}
            </Text>
          </View>
        </View>

        <View
          style={styles.section}
          break={Boolean(
            data.context ||
            data.problems.length ||
            data.solutions.length ||
            data.scopeModules.length ||
            deliverables ||
            acceptanceCriteria,
          )}
        >
          <Text style={styles.sectionLabel}>{copy.economics}</Text>
          <Text style={styles.sectionTitle}>Inversión y alcance</Text>
          <View style={styles.investment}>
            <Text style={styles.investmentLabel}>{copy.investment}</Text>
            <Text style={styles.investmentValue}>{money(data.subtotal)}</Text>
            <Text style={styles.investmentText}>
              {ca
                ? `S'hi afegirà l'IVA corresponent: ${money(data.taxAmount)}.`
                : en
                  ? `VAT of ${money(data.taxAmount)} will be added.`
                  : `Se añadirá el IVA correspondiente: ${money(data.taxAmount)}.`}
            </Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: '70%' }]}>{copy.concept}</Text>
              <Text style={[styles.tableHeaderText, { textAlign: 'right', width: '30%' }]}>
                {copy.amount}
              </Text>
            </View>
            {data.items.map((item) => (
              <View key={item.id} style={styles.row} wrap={false}>
                <View style={{ width: '70%' }}>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                  <Text
                    style={styles.itemMeta}
                  >{`${item.quantity} × ${money(item.unitPrice)} · IVA ${item.vatRate}% · ${cycleLabel(item.billingCycle, language)}`}</Text>
                </View>
                <Text style={[styles.amount, { width: '30%' }]}>{money(item.subtotal)}</Text>
              </View>
            ))}
          </View>
          {hasRecurring ? (
            <Text style={styles.body}>
              Las líneas recurrentes se muestran con su cadencia correspondiente y no forman parte
              de la inversión inicial.
            </Text>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{copy.total}</Text>
            <Text style={styles.totalValue}>{money(data.total)}</Text>
          </View>
        </View>

        {hasConditions || data.iban ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {hasConditions
                ? ca
                  ? 'Condicions i pagament'
                  : en
                    ? 'Terms and payment'
                    : 'Condiciones y pago'
                : copy.payment}
            </Text>
            {data.paymentTerms ? (
              <>
                <Text style={styles.pointTitle}>Forma de pago</Text>
                <Text style={styles.pointText}>
                  {PAYMENT_SCHEDULE_LABELS[data.paymentSchedule]}
                </Text>
                <Text style={styles.body}>{printableMarkdown(data.paymentTerms)}</Text>
              </>
            ) : null}
            {data.changeManagementTerms ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: 12 }]}>Cambios de alcance</Text>
                <Text style={styles.body}>{printableMarkdown(data.changeManagementTerms)}</Text>
              </>
            ) : null}
            {data.iban ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: hasConditions ? 12 : 0 }]}>
                  Pago por transferencia
                </Text>
                <Text style={styles.pointText}>
                  También puede abonar el primer plazo antes de recibir la factura con estos datos.
                </Text>
                <Text style={styles.body}>
                  Beneficiario: {data.companyName ?? '—'}
                  {`\n`}IBAN: {data.iban}
                  {`\n`}Concepto: Propuesta {data.number ?? data.title}
                  {initialPaymentPercentage !== null
                    ? `\nPrimer plazo (${initialPaymentPercentage}%): ${money((data.total * initialPaymentPercentage) / 100)}`
                    : ''}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}
        {data.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy.notes}</Text>
            <Text style={styles.body}>{printableMarkdown(data.notes)}</Text>
          </View>
        ) : null}
        {data.maintenanceOffer.enabled && data.maintenanceOffer.plans.length > 0 ? (
          <View style={styles.section} break>
            <Text style={styles.sectionLabel}>{copy.maintenance}</Text>
            <Text style={styles.sectionTitle}>{data.maintenanceOffer.heading}</Text>
            <Text style={styles.body}>{data.maintenanceOffer.intro}</Text>
            <MaintenancePlanList
              offer={data.maintenanceOffer}
              selectedPlanId={data.maintenanceSelectedPlanId}
            />
            <Text style={styles.body}>
              Selecciona desde la propuesta online la cobertura que mejor se ajuste al mantenimiento
              de tu sistema.
            </Text>
          </View>
        ) : null}
        {data.acceptance ? (
          <View style={styles.acceptance} break>
            <Text style={styles.sectionLabel}>{copy.acceptance}</Text>
            <Text style={[styles.sectionTitle, { fontSize: 15 }]}>{copy.signed}</Text>
            <Text style={styles.body}>
              {`Firmante: ${data.acceptance.signerName}${data.acceptance.signerRole ? ` · ${data.acceptance.signerRole}` : ''}`}
            </Text>
            <Text
              style={styles.body}
            >{`Fecha y hora (UTC): ${dateTime(data.acceptance.acceptedAt)}`}</Text>
            <Text style={styles.body}>
              {`Emisor: ${data.companyName ?? 'doscientos'}${data.companyNif ? ` · NIF ${data.companyNif}` : ''}`}
            </Text>
            {data.acceptance.clientCapacity ? (
              <Text style={styles.body}>
                {`${copy.capacity}: ${data.acceptance.clientCapacity === 'consumer' ? copy.consumer : copy.business}`}
              </Text>
            ) : null}
            {data.acceptance.clientCapacity === 'consumer' ? (
              <Text style={styles.body}>
                {data.acceptance.consumerEarlyStartRequested ? copy.earlyStart : copy.standardStart}
              </Text>
            ) : null}
            {data.acceptance.consentText ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: 10 }]}>{copy.declaration}</Text>
                <Text style={styles.pointText}>{data.acceptance.consentText}</Text>
              </>
            ) : null}
            <Text
              style={styles.acceptanceHash}
            >{`Huella SHA-256 del documento aceptado: ${data.acceptance.documentHash}`}</Text>
          </View>
        ) : data.acceptedWithoutSignature ? (
          <View style={styles.acceptance} break wrap={false}>
            <Text style={styles.sectionLabel}>{copy.accepted}</Text>
            <Text style={styles.body}>{copy.manualAcceptance}</Text>
          </View>
        ) : (
          <View style={styles.cta} wrap={false}>
            <Text style={styles.ctaText}>
              ¿Todo claro? Revisa la propuesta online y confírmala para que podamos empezar.
            </Text>
            <Link src={data.portalUrl} style={styles.ctaLink}>
              Revisar y aceptar la propuesta →
            </Link>
          </View>
        )}
        <Footer language={language} />
      </Page>
      <Page size="A4" style={styles.page} wrap>
        <View fixed style={styles.header}>
          <Text style={styles.brand}>doscientos</Text>
          <Text style={styles.pageLabel}>
            {ca ? 'Annex de la proposta' : en ? 'Proposal annex' : 'Anexo de la propuesta'}{' '}
            {data.number ?? copy.custom}
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{copy.annex}</Text>
          <Text style={styles.sectionTitle}>{copy.terms}</Text>
          <LegalTerms source={data.legalTerms} />
        </View>
        <Footer language={language} />
      </Page>
    </Document>
  )
}

export async function renderProposalPdf(data: ProposalPdfData): Promise<Buffer> {
  return renderToBuffer(<ProposalPdfDocument data={data} />)
}
