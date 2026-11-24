import {
  Document,
  Font,
  Link,
  Page,
  Path,
  renderToBuffer,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer'

import { formatPortalDate, formatPortalEUR, type PortalLanguage } from '@/lib/portal/language'
import {
  type HandwrittenSignature,
  handwrittenStrokePath,
  type ProviderSignature,
} from '@/lib/proposals/handwritten-signature'
import type { KeyPoint } from '@/lib/proposals/key-points'
import { type MaintenanceOffer, recommendedMaintenancePlanId } from '@/lib/proposals/maintenance'
import {
  proposalTr,
  publicPaymentScheduleLabel,
  publicScopeDuration,
} from '@/lib/proposals/public-copy'
import {
  type PaymentSchedule,
  paymentInitialPercentage,
  type ScopeModule,
} from '@/lib/proposals/scope'
import { formatTimelineDate, timelineLayout, type TimelineItem } from '@/lib/proposals/timeline'

const BRAND = '#2A4227'
const INK = '#183017'
const ACCENT = '#BDFF7B'
const PAPER = '#FAFAF7'
const MIST = '#E9F1E6'
const MUTED = '#657067'

Font.registerHyphenationCallback((word) => [word])

// Allow long unbroken identifiers and names to wrap within the cover.
function coverHyphenation(chunkSize: number, threshold = chunkSize) {
  return (word: string): string[] => {
    const characters = Array.from(word)
    if (characters.length <= threshold) return [word]
    const parts: string[] = []
    for (let i = 0; i < characters.length; i += chunkSize) {
      parts.push(characters.slice(i, i + chunkSize).join(''))
    }
    return parts
  }
}

const coverWordBreaks = coverHyphenation(12, 15)
const longCoverTitleWordBreaks = coverHyphenation(18)

const styles = StyleSheet.create({
  cover: { backgroundColor: PAPER, color: INK, fontFamily: 'Helvetica', padding: 48 },
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
  coverHeader: { borderTopColor: ACCENT, borderTopWidth: 7, paddingTop: 18 },
  coverBrand: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 14, letterSpacing: 0.5 },
  coverTag: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 1,
    lineHeight: 1.4,
    textTransform: 'uppercase',
  },
  coverHero: { marginTop: 48 },
  coverTitle: {
    color: INK,
    fontFamily: 'Helvetica-Bold',
    fontSize: 34,
    lineHeight: 1.12,
    marginTop: 15,
  },
  coverRecipientLabel: { color: MUTED, fontSize: 9, marginTop: 20 },
  coverRecipient: {
    color: INK,
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    lineHeight: 1.35,
    marginTop: 5,
  },
  metricCard: { backgroundColor: BRAND, borderRadius: 14, marginTop: 24, padding: 20 },
  metricLabel: {
    color: '#DDE9DB',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  metricValue: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 27, marginTop: 7 },
  metricText: { color: '#DDE9DB', fontSize: 9, lineHeight: 1.4, marginTop: 6 },
  coverSpacer: { flexGrow: 1, minHeight: 28 },
  coverFooter: {
    borderTopColor: '#D9E1D7',
    borderTopWidth: 1,
    color: MUTED,
    fontSize: 8,
    paddingTop: 12,
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
  maintenanceRecommendation: {
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
  discountPercent?: number
  discountReason?: string | null
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
  timeline?: TimelineItem[]
  historical?: boolean
  developmentApproach?: string | null
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
  /** One-time discount breakdown; omitted/zero when the proposal has no discounts. */
  discounts?: {
    gross: number
    lineDiscount: number
    globalDiscount: number
    globalReason?: string | null
  }
  items: ProposalPdfItem[]
  maintenanceOffer: MaintenanceOffer
  portalUrl: string
  companyName: string | null
  companyNif?: string | null
  companyAddress?: string | null
  iban: string | null
  providerSignature?: ProviderSignature | null
  acceptance?: {
    signerName: string
    signerRole: string | null
    acceptedAt: string
    documentHash: string
    consentText?: string | null
    clientCapacity?: 'business' | 'consumer' | null
    consumerEarlyStartRequested?: boolean
    handwrittenSignature?: HandwrittenSignature | null
  } | null
  acceptedWithoutSignature?: boolean
}

function SignatureDrawing({ signature }: { signature: HandwrittenSignature }) {
  return (
    <Svg width={210} height={84} viewBox="0 0 600 240">
      {signature.strokes.map((stroke, index) => (
        <Path
          key={index}
          d={handwrittenStrokePath(stroke)}
          fill="none"
          stroke="#111827"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  )
}

function dateTime(value: string, language: PortalLanguage): string {
  return new Intl.DateTimeFormat(`${language}-${language === 'en' ? 'GB' : 'ES'}`, {
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

function ScopeModuleList({
  modules,
  language,
}: {
  modules: ScopeModule[]
  language: PortalLanguage
}) {
  const tr = proposalTr(language)
  return (
    <>
      {modules.map((module, index) => (
        <View key={module.id} style={styles.point} wrap={false}>
          <Text
            style={styles.pointTitle}
          >{`${String(index + 1).padStart(2, '0')} · ${module.title}`}</Text>
          {module.description ? <Text style={styles.pointText}>{module.description}</Text> : null}
          {publicScopeDuration(module, language) ? (
            <Text
              style={styles.pointText}
            >{`${tr('Plazo estimado', 'Termini estimat', 'Estimated duration')}: ${publicScopeDuration(module, language)}`}</Text>
          ) : null}
          {module.included.length > 0 ? (
            <Text style={[styles.pointText, { color: BRAND, fontFamily: 'Helvetica-Bold' }]}>
              {tr('Incluido', 'Inclòs', 'Included')}
            </Text>
          ) : null}
          {module.included.map((item) => (
            <Text key={`included-${item}`} style={styles.bullet}>{`• ${item}`}</Text>
          ))}
          {module.excluded.length > 0 ? (
            <Text style={[styles.pointText, { fontFamily: 'Helvetica-Bold' }]}>
              {tr('No incluido', 'No inclòs', 'Not included')}
            </Text>
          ) : null}
          {module.excluded.map((item) => (
            <Text key={`excluded-${item}`} style={styles.bullet}>{`• ${item}`}</Text>
          ))}
          {module.notes ? (
            <Text
              style={styles.pointText}
            >{`${tr('Notas', 'Notes', 'Notes')}: ${module.notes}`}</Text>
          ) : null}
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
  language,
}: {
  offer: MaintenanceOffer
  language: PortalLanguage
}) {
  const tr = proposalTr(language)
  const recommendedPlanId = recommendedMaintenancePlanId(offer)
  return (
    <View style={styles.maintenanceTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { width: '74%' }]}>
          {tr('Cobertura', 'Cobertura', 'Coverage')}
        </Text>
        <Text style={[styles.tableHeaderText, { textAlign: 'right', width: '26%' }]}>
          {tr('Cuota mensual', 'Quota mensual', 'Monthly fee')}
        </Text>
      </View>
      {offer.plans.map((plan) => {
        const recommended = plan.id === recommendedPlanId
        return (
          <View key={plan.id} style={styles.maintenanceRow} wrap={false}>
            <View style={{ width: '74%' }}>
              <Text style={styles.maintenancePlanName}>{plan.name}</Text>
              {recommended ? (
                <Text style={styles.maintenanceRecommendation}>
                  {tr('Recomendado', 'Recomanat', 'Recommended')}
                </Text>
              ) : null}
              <Text style={styles.maintenanceSummary}>{plan.summary}</Text>
              <Text style={styles.maintenanceListLabel}>{tr('Incluye', 'Inclou', 'Includes')}</Text>
              <Text style={styles.maintenanceList}>{plan.coverage.join(' · ')}</Text>
              {plan.exclusions.length > 0 ? (
                <>
                  <Text style={styles.maintenanceListLabel}>
                    {tr('No incluye', 'No inclou', 'Excludes')}
                  </Text>
                  <Text style={styles.maintenanceList}>{plan.exclusions.join(' · ')}</Text>
                </>
              ) : null}
            </View>
            <View style={{ width: '26%' }}>
              <Text
                style={styles.maintenancePrice}
              >{`${formatPortalEUR(plan.monthly_price, language)} / ${tr('mes', 'mes', 'month')}`}</Text>
              <Text style={styles.maintenanceVat}>+ {tr('IVA', 'IVA', 'VAT')}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function ProposalPdfDocument({ data }: { data: ProposalPdfData }) {
  const language = data.language ?? 'es'
  const tr = proposalTr(language)
  const money = (value: number) => formatPortalEUR(value, language)
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
    gross: ca ? 'Import brut' : en ? 'Gross amount' : 'Importe bruto',
    lineDiscount: ca ? 'Descomptes en partides' : en ? 'Line discounts' : 'Descuentos en partidas',
    globalDiscount: ca ? 'Descompte' : en ? 'Discount' : 'Descuento',
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
  const validUntil = data.validUntil ? formatPortalDate(data.validUntil, language) : null
  const hasRecurring = data.items.some((item) => item.billingCycle && item.billingCycle !== 'none')
  const deliverables = data.deliverables?.trim()
  const developmentApproach = data.developmentApproach?.trim()
  const acceptanceCriteria = data.acceptanceCriteria?.trim()
  const initialPaymentPercentage = paymentInitialPercentage(data.paymentSchedule)
  const hasConditions = Boolean(data.paymentTerms || data.changeManagementTerms)
  return (
    <Document title={`${copy.proposal} ${data.number ?? ''} · ${data.title}`} author="doscientos">
      <Page size="A4" style={styles.cover} wrap>
        <View style={styles.coverHeader}>
          <Text style={styles.coverBrand}>doscientos</Text>
        </View>
        <View style={styles.coverHero}>
          <Text style={styles.coverTag} hyphenationCallback={coverWordBreaks}>
            {copy.proposal} · {data.number ?? copy.custom}
          </Text>
          <Text
            style={[
              styles.coverTitle,
              { fontSize: data.title.length > 140 ? 21 : data.title.length > 80 ? 27 : 34 },
            ]}
            hyphenationCallback={
              data.title.length > 80 ? longCoverTitleWordBreaks : coverWordBreaks
            }
          >
            {data.title}
          </Text>
          <Text style={styles.coverRecipientLabel}>{copy.prepared}</Text>
          <Text style={styles.coverRecipient} hyphenationCallback={coverWordBreaks}>
            {data.recipientName}
          </Text>
        </View>
        <View style={styles.metricCard} wrap={false}>
          <Text style={styles.metricLabel}>{copy.investment}</Text>
          <Text style={styles.metricValue}>{money(data.subtotal)}</Text>
          <Text style={styles.metricText}>{copy.taxExcluded}</Text>
          {validUntil ? (
            <Text style={styles.metricText}>{`${copy.valid} ${validUntil}.`}</Text>
          ) : null}
        </View>
        <View style={styles.coverSpacer} />
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
            <Text style={styles.sectionTitle}>
              {tr('El punto de partida', 'El punt de partida', 'The starting point')}
            </Text>
            <Text style={styles.body}>{printableMarkdown(data.context)}</Text>
          </View>
        ) : null}

        {data.problems.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy.challenges}</Text>
            <Text style={styles.sectionTitle}>
              {tr('Lo que queremos resolver', 'Allò que volem resoldre', 'What we want to solve')}
            </Text>
            <PointList points={data.problems} />
          </View>
        ) : null}

        {data.solutions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {tr('Nuestra propuesta', 'La nostra proposta', 'Our proposal')}
            </Text>
            <Text style={styles.sectionTitle}>
              {tr('Cómo lo abordamos', 'Com ho abordem', 'How we approach it')}
            </Text>
            <PointList points={data.solutions} />
          </View>
        ) : null}

        {data.scopeModules.length > 0 ? (
          <View
            style={styles.section}
            break={Boolean(data.context || data.problems.length || data.solutions.length)}
          >
            <Text style={styles.sectionLabel}>{copy.proposalScope}</Text>
            <Text style={styles.sectionTitle}>
              {tr(
                'Qué incluye esta propuesta',
                'Què inclou aquesta proposta',
                'What this proposal includes',
              )}
            </Text>
            <ScopeModuleList modules={data.scopeModules} language={language} />
          </View>
        ) : null}

        {deliverables || acceptanceCriteria ? (
          <View style={styles.section} break={data.scopeModules.length > 0}>
            <Text style={styles.sectionLabel}>
              {tr('Entrega y validación', 'Lliurament i validació', 'Delivery and validation')}
            </Text>
            {deliverables ? (
              <>
                <Text style={styles.pointTitle}>
                  {tr('Entregables', 'Lliurables', 'Deliverables')}
                </Text>
                <Text style={styles.body}>{printableMarkdown(deliverables)}</Text>
              </>
            ) : null}
            {acceptanceCriteria ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: 12 }]}>
                  {tr('Criterios de aceptación', 'Criteris d’acceptació', 'Acceptance criteria')}
                </Text>
                <Text style={styles.body}>{printableMarkdown(acceptanceCriteria)}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        {data.timeline?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{tr('El camino', 'El camí', 'The journey')}</Text>
            <Text style={styles.sectionTitle}>
              {tr('Plazos del proyecto', 'Terminis del projecte', 'Project timeline')}
            </Text>
            {timelineLayout(data.timeline).map(({ item, left, width }) => (
              <View key={item.id} style={{ marginBottom: 12 }} wrap={false}>
                <Text style={styles.pointTitle}>{item.title}</Text>
                <Text style={styles.pointText}>
                  {formatTimelineDate(item.start_date, language)}
                  {item.start_date !== item.end_date
                    ? ` – ${formatTimelineDate(item.end_date, language)}`
                    : ''}
                </Text>
                {item.description ? <Text style={styles.pointText}>{item.description}</Text> : null}
                <View style={{ height: 7, backgroundColor: MIST, marginTop: 5, borderRadius: 4 }}>
                  <View
                    style={{
                      height: 7,
                      backgroundColor: BRAND,
                      borderRadius: 4,
                      marginLeft: `${left}%`,
                      width: `${width}%`,
                    }}
                  />
                </View>
              </View>
            ))}
            {!data.historical ? (
              <Link
                src={`${data.portalUrl}#plazos`}
                style={{ color: BRAND, fontSize: 10, marginTop: 4 }}
              >
                {tr(
                  'Añadir al calendario desde la propuesta online →',
                  'Afegir al calendari des de la proposta en línia →',
                  'Add to calendar from the online proposal →',
                )}
              </Link>
            ) : null}
          </View>
        ) : null}

        {developmentApproach ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {ca
                ? 'Com treballarem durant el desenvolupament'
                : en
                  ? 'How we will work during development'
                  : 'Cómo trabajaremos durante el desarrollo'}
            </Text>
            <Text style={styles.body}>{printableMarkdown(developmentApproach)}</Text>
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
            developmentApproach ||
            deliverables ||
            acceptanceCriteria,
          )}
        >
          <Text style={styles.sectionLabel}>{copy.economics}</Text>
          <Text style={styles.sectionTitle}>
            {tr('Inversión y alcance', 'Inversió i abast', 'Investment and scope')}
          </Text>
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
                  >{`${item.quantity} × ${money(item.unitPrice)} · ${tr('IVA', 'IVA', 'VAT')} ${item.vatRate}% · ${cycleLabel(item.billingCycle, language)}`}</Text>
                  {item.discountPercent && item.discountPercent > 0 ? (
                    <Text style={styles.itemMeta}>
                      {`−${item.discountPercent}%${item.discountReason ? ` · ${item.discountReason}` : ''}`}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.amount, { width: '30%' }]}>
                  {money(
                    item.discountPercent && item.discountPercent > 0
                      ? Math.round(item.subtotal * (1 - item.discountPercent / 100) * 100) / 100
                      : item.subtotal,
                  )}
                </Text>
              </View>
            ))}
          </View>
          {hasRecurring ? (
            <Text style={styles.body}>
              {tr(
                'Las líneas recurrentes se muestran con su cadencia correspondiente y no forman parte de la inversión inicial.',
                'Les partides recurrents es mostren amb la seva periodicitat i no formen part de la inversió inicial.',
                'Recurring items are shown with their billing frequency and are not part of the initial investment.',
              )}
            </Text>
          ) : null}
          {data.discounts &&
          (data.discounts.lineDiscount > 0 || data.discounts.globalDiscount > 0) ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{copy.gross}</Text>
                <Text style={styles.totalValue}>{money(data.discounts.gross)}</Text>
              </View>
              {data.discounts.lineDiscount > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{copy.lineDiscount}</Text>
                  <Text style={styles.totalValue}>{`−${money(data.discounts.lineDiscount)}`}</Text>
                </View>
              ) : null}
              {data.discounts.globalDiscount > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {`${copy.globalDiscount}${data.discounts.globalReason ? ` · ${data.discounts.globalReason}` : ''}`}
                  </Text>
                  <Text
                    style={styles.totalValue}
                  >{`−${money(data.discounts.globalDiscount)}`}</Text>
                </View>
              ) : null}
            </>
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
                <Text style={styles.pointTitle}>
                  {tr('Forma de pago', 'Forma de pagament', 'Payment terms')}
                </Text>
                <Text style={styles.pointText}>
                  {publicPaymentScheduleLabel(data.paymentSchedule, language)}
                </Text>
                <Text style={styles.body}>{printableMarkdown(data.paymentTerms)}</Text>
              </>
            ) : null}
            {data.changeManagementTerms ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: 12 }]}>
                  {tr('Cambios de alcance', 'Canvis d’abast', 'Scope changes')}
                </Text>
                <Text style={styles.body}>{printableMarkdown(data.changeManagementTerms)}</Text>
              </>
            ) : null}
            {data.iban ? (
              <>
                <Text style={[styles.pointTitle, { marginTop: hasConditions ? 12 : 0 }]}>
                  {tr(
                    'Pago por transferencia',
                    'Pagament per transferència',
                    'Payment by bank transfer',
                  )}
                </Text>
                <Text style={styles.pointText}>
                  {tr(
                    'También puede abonar el primer plazo antes de recibir la factura con estos datos.',
                    'També podeu abonar el primer termini abans de rebre la factura amb aquestes dades.',
                    'You can also pay the first instalment before receiving the invoice using these details.',
                  )}
                </Text>
                <Text style={styles.body}>
                  {tr('Beneficiario', 'Beneficiari', 'Beneficiary')}: {data.companyName ?? '—'}
                  {`\n`}IBAN: {data.iban}
                  {`\n`}
                  {tr('Concepto', 'Concepte', 'Reference')}: {copy.proposal}{' '}
                  {data.number ?? data.title}
                  {initialPaymentPercentage !== null
                    ? `\n${tr('Primer plazo', 'Primer termini', 'First instalment')} (${initialPaymentPercentage}%): ${money((data.total * initialPaymentPercentage) / 100)}`
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
            <MaintenancePlanList offer={data.maintenanceOffer} language={language} />
            <Text style={styles.body}>
              {tr(
                'Opciones de mantenimiento para valorar, con nuestra recomendación destacada. No están incluidas en el importe de la propuesta.',
                'Opcions de manteniment per valorar, amb la nostra recomanació destacada. No estan incloses en l’import de la proposta.',
                'Maintenance options for consideration, with our recommendation highlighted. They are not included in the proposal amount.',
              )}
            </Text>
          </View>
        ) : null}
        {data.providerSignature && !data.acceptance ? (
          <View style={styles.acceptance} wrap={false}>
            <Text style={styles.sectionLabel}>
              {tr('Firma del proveedor', 'Signatura del proveïdor', 'Provider signature')}
            </Text>
            <SignatureDrawing signature={data.providerSignature.drawing} />
            <Text style={styles.body}>
              {data.providerSignature.name}
              {data.providerSignature.job_title ? ` · ${data.providerSignature.job_title}` : ''}
            </Text>
          </View>
        ) : null}
        {data.acceptance ? (
          <View style={styles.acceptance} break>
            <Text style={styles.sectionLabel}>{copy.acceptance}</Text>
            <Text style={[styles.sectionTitle, { fontSize: 15 }]}>{copy.signed}</Text>
            {data.acceptance.handwrittenSignature ? (
              <SignatureDrawing signature={data.acceptance.handwrittenSignature} />
            ) : null}
            <Text style={styles.body}>
              {`${tr('Firmante', 'Signant', 'Signer')}: ${data.acceptance.signerName}${data.acceptance.signerRole ? ` · ${data.acceptance.signerRole}` : ''}`}
            </Text>
            <Text
              style={styles.body}
            >{`${tr('Fecha y hora', 'Data i hora', 'Date and time')} (UTC): ${dateTime(data.acceptance.acceptedAt, language)}`}</Text>
            <Text style={styles.body}>
              {`${tr('Emisor', 'Emissor', 'Issuer')}: ${data.companyName ?? 'doscientos'}${data.companyNif ? ` · ${copy.taxId} ${data.companyNif}` : ''}`}
            </Text>
            {data.providerSignature ? (
              <View wrap={false}>
                <Text style={[styles.pointTitle, { marginTop: 10 }]}>
                  {tr('Firma del proveedor', 'Signatura del proveïdor', 'Provider signature')}
                </Text>
                <SignatureDrawing signature={data.providerSignature.drawing} />
                <Text style={styles.body}>
                  {data.providerSignature.name}
                  {data.providerSignature.job_title ? ` · ${data.providerSignature.job_title}` : ''}
                </Text>
              </View>
            ) : null}
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
            >{`${tr('Huella SHA-256 del documento aceptado', 'Empremta SHA-256 del document acceptat', 'SHA-256 fingerprint of the accepted document')}: ${data.acceptance.documentHash}`}</Text>
          </View>
        ) : data.acceptedWithoutSignature ? (
          <View style={styles.acceptance} break wrap={false}>
            <Text style={styles.sectionLabel}>{copy.accepted}</Text>
            <Text style={styles.body}>{copy.manualAcceptance}</Text>
          </View>
        ) : (
          <View style={styles.cta} wrap={false}>
            <Text style={styles.ctaText}>
              {tr(
                '¿Todo claro? Revisa la propuesta online y confírmala para que podamos empezar.',
                'Tot clar? Revisa la proposta en línia i confirma-la perquè puguem començar.',
                'All clear? Review and confirm the proposal online so we can get started.',
              )}
            </Text>
            <Link src={data.portalUrl} style={styles.ctaLink}>
              {tr(
                'Revisar y aceptar la propuesta →',
                'Revisar i acceptar la proposta →',
                'Review and accept the proposal →',
              )}
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
