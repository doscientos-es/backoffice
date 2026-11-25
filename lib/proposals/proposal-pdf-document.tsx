import {
  Document,
  Font,
  Link,
  Page,
  Path,
  Rect,
  renderToBuffer,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer'
import { marked, type Token, type Tokens } from 'marked'
import { create as createQrCode } from 'qrcode'

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
const INK = '#1D261E'
const PAPER = '#F8F9F5'
const MIST = '#EEF2EB'
const MUTED = '#505B52'
const RULE = '#D7DED5'
const SIDE = 48

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
  cover: { backgroundColor: PAPER, color: INK, fontFamily: 'Helvetica', padding: SIDE },
  page: {
    backgroundColor: '#FFFFFF',
    color: INK,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    paddingBottom: 60,
    paddingHorizontal: SIDE,
    paddingTop: 62,
  },
  brand: { color: BRAND, fontFamily: 'Helvetica-Bold', fontSize: 11 },
  coverHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  coverBrand: { color: BRAND, fontFamily: 'Helvetica-Bold', fontSize: 17 },
  coverReference: { color: MUTED, fontSize: 10, maxWidth: '55%', textAlign: 'right' },
  coverHero: { marginTop: 94 },
  coverTitle: {
    color: INK,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.08,
  },
  coverRecipient: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 1.28,
    marginTop: 16,
  },
  coverInvestment: {
    borderTopColor: RULE,
    borderTopWidth: 1,
    marginTop: 34,
    paddingTop: 18,
  },
  metricLabel: { color: MUTED, fontSize: 11 },
  metricValue: { color: BRAND, fontFamily: 'Helvetica-Bold', fontSize: 30, marginTop: 4 },
  metricText: { color: MUTED, fontSize: 10, lineHeight: 1.4, marginTop: 12 },
  coverSpacer: { flexGrow: 1, minHeight: 28 },
  coverFooter: {
    borderTopColor: RULE,
    borderTopWidth: 1,
    color: MUTED,
    fontSize: 8,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: RULE,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: SIDE,
    paddingBottom: 9,
    position: 'absolute',
    right: SIDE,
    top: 29,
  },
  pageLabel: { color: MUTED, fontSize: 9 },
  section: { marginTop: 21 },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 17, lineHeight: 1.2, marginBottom: 6 },
  body: { color: INK, fontSize: 10.5, lineHeight: 1.5, marginTop: 5 },
  point: {
    borderTopColor: RULE,
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 9,
    paddingBottom: 4,
  },
  pointTitle: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 11 },
  pointText: { color: MUTED, fontSize: 10, lineHeight: 1.4, marginTop: 4 },
  parties: { flexDirection: 'row', columnGap: 24 },
  maintenanceRecommendation: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    marginTop: 3,
  },
  maintenanceListLabel: {
    color: INK,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginTop: 6,
  },
  maintenanceList: { color: MUTED, fontSize: 9, lineHeight: 1.4, marginTop: 2 },
  maintenancePrice: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textAlign: 'right',
  },
  maintenanceVat: { color: MUTED, fontSize: 9, marginTop: 2, textAlign: 'right' },
  table: { marginTop: 9 },
  tableHeader: {
    backgroundColor: MIST,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  tableHeaderText: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  row: {
    borderBottomColor: RULE,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  itemDescription: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  itemMeta: { color: MUTED, fontSize: 9, marginTop: 3 },
  amount: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 10, textAlign: 'right' },
  totalRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  totalLabel: { color: MUTED, flexShrink: 1, fontSize: 10, marginRight: 15 },
  totalValue: { color: INK, fontSize: 10, minWidth: 72, textAlign: 'right' },
  grandTotal: { color: BRAND, fontFamily: 'Helvetica-Bold', fontSize: 12 },
  footer: {
    borderTopColor: RULE,
    borderTopWidth: 1,
    bottom: 25,
    color: MUTED,
    flexDirection: 'row',
    fontSize: 8,
    justifyContent: 'space-between',
    left: SIDE,
    paddingTop: 8,
    position: 'absolute',
    right: SIDE,
  },
  bullet: { color: INK, fontSize: 10, lineHeight: 1.4, marginTop: 3, paddingLeft: 8 },
  cta: {
    alignItems: 'center',
    backgroundColor: MIST,
    flexDirection: 'row',
    marginTop: 24,
    padding: 16,
  },
  ctaCopy: { flex: 1, paddingRight: 16 },
  ctaLink: {
    color: BRAND,
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    textDecoration: 'underline',
  },
  acceptance: { borderTopColor: RULE, borderTopWidth: 1, marginTop: 21, paddingTop: 12 },
  acceptanceHash: { color: MUTED, fontSize: 8, lineHeight: 1.4, marginTop: 8 },
  legalClause: { marginBottom: 10 },
  legalTitle: { color: INK, fontFamily: 'Helvetica-Bold', fontSize: 10, lineHeight: 1.3 },
  legalBody: { color: MUTED, fontSize: 9.5, lineHeight: 1.45, marginTop: 3 },
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
  canAccept?: boolean
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

function AcceptanceQr({ url }: { url: string }) {
  const { modules } = createQrCode(url, { errorCorrectionLevel: 'M' })
  // The four-module white border keeps the QR scannable against the callout background.
  const margin = 4
  const size = modules.size + margin * 2
  const cells: string[] = []
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) cells.push(`M${col + margin} ${row + margin}h1v1h-1z`)
    }
  }
  return (
    <Svg width={96} height={96} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
      <Path d={cells.join(' ')} fill="#000000" />
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

/** ASCII-only attachment name, with each part capped to fit common filesystem limits. */
export function proposalPdfFilename(title: string, recipientName: string): string {
  const filePart = (value: string, fallback: string) =>
    value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .slice(0, 100)
      .replace(/^-+|-+$/g, '') || fallback

  return `${filePart(title, 'propuesta')}-${filePart(recipientName, 'cliente')}-doscientos.pdf`
}

export function printableMarkdown(value: string | null): string {
  return (value ?? '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function PdfMarkdownInline({ tokens }: { tokens: Token[] }) {
  return tokens.map((token, index) => {
    if (token.type === 'strong' || token.type === 'em') {
      return (
        <Text
          key={index}
          style={{ fontFamily: token.type === 'strong' ? 'Helvetica-Bold' : 'Helvetica-Oblique' }}
        >
          <PdfMarkdownInline tokens={token.tokens ?? marked.Lexer.lexInline(token.text)} />
        </Text>
      )
    }
    if (token.type === 'link')
      return (
        <PdfMarkdownInline
          key={index}
          tokens={token.tokens ?? marked.Lexer.lexInline(token.text)}
        />
      )
    if (token.type === 'br') return '\n'
    if ('text' in token && typeof token.text === 'string') return token.text
    return ''
  })
}

function PdfMarkdown({ source }: { source: string }) {
  return marked.lexer(source).map((token, index) => {
    if (token.type === 'space') return null
    if (token.type === 'paragraph' || token.type === 'heading') {
      return (
        <Text
          key={index}
          style={[
            styles.body,
            { marginBottom: 7 },
            token.type === 'heading' ? { fontFamily: 'Helvetica-Bold' } : {},
          ]}
        >
          <PdfMarkdownInline tokens={token.tokens ?? marked.Lexer.lexInline(token.text)} />
        </Text>
      )
    }
    if (token.type === 'list') {
      return token.items.map((item: Tokens.ListItem, itemIndex: number) => (
        <Text
          key={`${index}-${itemIndex}`}
          style={[styles.body, { marginBottom: 4, paddingLeft: 10 }]}
        >
          {token.ordered ? `${(Number(token.start) || 1) + itemIndex}. ` : '• '}
          <PdfMarkdownInline tokens={marked.Lexer.lexInline(item.text)} />
        </Text>
      ))
    }
    return (
      <Text key={index} style={styles.body}>
        {printableMarkdown(token.raw)}
      </Text>
    )
  })
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={styles.sectionTitle} minPresenceAhead={32}>
      {children}
    </Text>
  )
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
      <Text>{label}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function PointList({ points }: { points: KeyPoint[] }) {
  return (
    <>
      {points.map((point) => (
        <View key={point.id} style={styles.point}>
          <Text style={styles.pointTitle} minPresenceAhead={22}>
            {point.title}
          </Text>
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
        <View key={module.id} style={styles.point}>
          <Text
            style={styles.pointTitle}
            minPresenceAhead={22}
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
          <View key={`clause-${index}`} style={styles.legalClause}>
            <Text
              style={styles.legalTitle}
              minPresenceAhead={20}
            >{`${match[1]}. ${match[2]}`}</Text>
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
    <View style={styles.table}>
      <View style={styles.tableHeader} minPresenceAhead={42}>
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
          <View key={plan.id} style={styles.row} wrap={false}>
            <View style={{ width: '74%' }}>
              <Text style={styles.pointTitle}>{plan.name}</Text>
              {recommended ? (
                <Text style={styles.maintenanceRecommendation}>
                  {tr('Recomendado', 'Recomanat', 'Recommended')}
                </Text>
              ) : null}
              <Text style={styles.pointText}>{plan.summary}</Text>
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
    investment: ca ? 'Inversió inicial' : en ? 'Initial investment' : 'Inversión inicial',
    vat: en ? 'VAT' : 'IVA',
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
  const reference = data.number ? `${copy.proposal} ${data.number}` : copy.proposal
  return (
    <Document title={`${reference} · ${data.title}`} author="doscientos">
      <Page size="A4" style={styles.cover} wrap>
        <View style={styles.coverHeader}>
          <Text style={styles.coverBrand}>doscientos</Text>
          <Text style={styles.coverReference} hyphenationCallback={coverWordBreaks}>
            {reference}
          </Text>
        </View>
        <View style={styles.coverHero}>
          <Text
            style={[
              styles.coverTitle,
              { fontSize: data.title.length > 140 ? 22 : data.title.length > 80 ? 28 : 36 },
            ]}
            hyphenationCallback={
              data.title.length > 80 ? longCoverTitleWordBreaks : coverWordBreaks
            }
          >
            {data.title}
          </Text>
          <Text style={styles.coverRecipient} hyphenationCallback={coverWordBreaks}>
            {data.recipientName}
          </Text>
        </View>
        <View style={styles.coverInvestment} wrap={false}>
          <Text style={styles.metricLabel}>{copy.investment}</Text>
          <Text style={styles.metricValue}>{money(data.subtotal)}</Text>
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
          <Text style={styles.pageLabel}>{reference}</Text>
        </View>

        {data.context ? (
          <View style={styles.section}>
            <SectionTitle>{copy.context}</SectionTitle>
            <Text style={styles.body}>{printableMarkdown(data.context)}</Text>
          </View>
        ) : null}

        {data.problems.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>{copy.challenges}</SectionTitle>
            <PointList points={data.problems} />
          </View>
        ) : null}

        {data.solutions.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>
              {tr('Solución propuesta', 'Solució proposada', 'Proposed solution')}
            </SectionTitle>
            <PointList points={data.solutions} />
          </View>
        ) : null}

        {data.scopeModules.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>{copy.proposalScope}</SectionTitle>
            <ScopeModuleList modules={data.scopeModules} language={language} />
          </View>
        ) : null}

        {deliverables || acceptanceCriteria ? (
          <View style={styles.section}>
            <SectionTitle>
              {tr('Entrega y validación', 'Lliurament i validació', 'Delivery and validation')}
            </SectionTitle>
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
            <SectionTitle>
              {tr('Plazos del proyecto', 'Terminis del projecte', 'Project timeline')}
            </SectionTitle>
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
            <SectionTitle>
              {ca
                ? 'Com treballarem durant el desenvolupament'
                : en
                  ? 'How we will work during development'
                  : 'Cómo trabajaremos durante el desarrollo'}
            </SectionTitle>
            <PdfMarkdown source={developmentApproach} />
          </View>
        ) : null}

        <View style={styles.section} wrap={false}>
          <SectionTitle>{copy.parties}</SectionTitle>
          <View style={styles.parties}>
            <View style={[styles.point, { flex: 1 }]}>
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
            <View style={[styles.point, { flex: 1 }]}>
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
        </View>

        <View style={styles.section}>
          <SectionTitle>{copy.economics}</SectionTitle>
          <View style={styles.table}>
            <View style={styles.tableHeader} minPresenceAhead={32}>
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
          <View wrap={false}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{copy.investment}</Text>
              <Text style={styles.totalValue}>{money(data.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{copy.vat}</Text>
              <Text style={styles.totalValue}>{money(data.taxAmount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, styles.grandTotal]}>{copy.total}</Text>
              <Text style={[styles.totalValue, styles.grandTotal]}>{money(data.total)}</Text>
            </View>
          </View>
        </View>

        {hasConditions || data.iban ? (
          <View style={styles.section}>
            <SectionTitle>
              {hasConditions
                ? ca
                  ? 'Condicions i pagament'
                  : en
                    ? 'Terms and payment'
                    : 'Condiciones y pago'
                : copy.payment}
            </SectionTitle>
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
            <SectionTitle>{copy.notes}</SectionTitle>
            <Text style={styles.body}>{printableMarkdown(data.notes)}</Text>
          </View>
        ) : null}
        {data.maintenanceOffer.enabled && data.maintenanceOffer.plans.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle>{data.maintenanceOffer.heading}</SectionTitle>
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
            <SectionTitle>
              {tr('Firma del proveedor', 'Signatura del proveïdor', 'Provider signature')}
            </SectionTitle>
            <SignatureDrawing signature={data.providerSignature.drawing} />
            <Text style={styles.body}>
              {data.providerSignature.name}
              {data.providerSignature.job_title ? ` · ${data.providerSignature.job_title}` : ''}
            </Text>
          </View>
        ) : null}
        {data.acceptance ? (
          <View style={styles.acceptance} break>
            <SectionTitle>{copy.signed}</SectionTitle>
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
          <View style={styles.acceptance} wrap={false}>
            <SectionTitle>{copy.accepted}</SectionTitle>
            <Text style={styles.body}>{copy.manualAcceptance}</Text>
          </View>
        ) : null}
        <Footer language={language} />
      </Page>
      <Page size="A4" style={styles.page} wrap>
        <View fixed style={styles.header}>
          <Text style={styles.brand}>doscientos</Text>
          <Text style={styles.pageLabel}>
            {tr('Anexo contractual', 'Annex contractual', 'Contractual annex')}
            {data.number ? ` · ${data.number}` : ''}
          </Text>
        </View>
        <View style={styles.section}>
          <SectionTitle>{copy.terms}</SectionTitle>
          <LegalTerms source={data.legalTerms} />
        </View>
        {data.canAccept ? (
          <View style={styles.cta} wrap={false}>
            <View style={styles.ctaCopy}>
              <Link src={data.portalUrl} style={styles.ctaLink}>
                {tr(
                  'Revisar y aceptar la propuesta',
                  'Revisar i acceptar la proposta',
                  'Review and accept the proposal',
                )}
              </Link>
              <Text style={styles.body}>
                {tr(
                  'Escanea el código o abre el enlace para firmar en línea.',
                  'Escaneja el codi o obre l’enllaç per signar en línia.',
                  'Scan the code or open the link to sign online.',
                )}
              </Text>
            </View>
            <AcceptanceQr url={data.portalUrl} />
          </View>
        ) : null}
        <Footer language={language} />
      </Page>
    </Document>
  )
}

export async function renderProposalPdf(data: ProposalPdfData): Promise<Buffer> {
  return renderToBuffer(<ProposalPdfDocument data={data} />)
}
