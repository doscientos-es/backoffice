import "server-only";

import { INVOICE_STATUS, type InvoiceStatus } from "@/lib/status";
import { formatDate, formatEUR } from "@/lib/utils";
import {
  Circle,
  Document,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { InvoicePdfData } from "./pdf-data";

const BRAND = "#2A4227";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const LINE = "#e4e4e7";
const INK = "#18181b";

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 64, paddingHorizontal: 40, fontSize: 9, color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandName: { fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 1, color: BRAND },
  docType: { marginTop: 4, fontSize: 8, color: FAINT, textTransform: "uppercase" },
  headerRight: { alignItems: "flex-end" },
  number: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK },
  status: {
    marginTop: 2,
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaRow: { marginTop: 4, fontSize: 8, color: MUTED },
  parties: { flexDirection: "row", marginTop: 28, gap: 24 },
  party: { flex: 1 },
  label: {
    fontSize: 7,
    color: FAINT,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: INK },
  partyLine: { fontSize: 8, color: MUTED, marginTop: 2 },
  table: { marginTop: 28, borderTopWidth: 1, borderColor: LINE },
  thead: { flexDirection: "row", borderBottomWidth: 1, borderColor: LINE, paddingVertical: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: LINE, paddingVertical: 7 },
  th: { fontSize: 7, color: FAINT, textTransform: "uppercase", letterSpacing: 0.5 },
  cDesc: { flex: 1, paddingRight: 8 },
  cNum: { width: 50, textAlign: "right" },
  cVat: { width: 40, textAlign: "right" },
  cAmount: { width: 70, textAlign: "right" },
  totals: { marginTop: 16, alignSelf: "flex-end", width: 220 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalMuted: { fontSize: 8, color: MUTED },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: LINE,
    marginTop: 4,
    paddingTop: 6,
  },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  fiscal: { flexDirection: "row", justifyContent: "space-between", marginTop: 28, gap: 16 },
  fiscalInfo: { flex: 1 },
  mono: { fontFamily: "Courier", fontSize: 7, color: MUTED, marginTop: 2 },
  qrWrap: { alignItems: "center" },
  qr: { width: 78, height: 78 },
  qrCaption: { fontSize: 6, color: FAINT, marginTop: 3 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderColor: LINE,
    paddingTop: 8,
  },
  footerText: { fontSize: 7, color: FAINT, lineHeight: 1.5 },
});

/** Brand mark recreated with react-pdf SVG primitives (matches LogoMark). */
function BrandMark() {
  return (
    <Svg width={14} height={14} viewBox="0 0 256 256">
      <Path
        d="M30 88.0355C40.3711 88.0355 50.3174 92.1554 57.6508 99.4889C64.9843 106.822 69.1041 116.769 69.1041 127.14C69.1041 137.511 64.9843 147.457 57.6508 154.79C50.3174 162.124 40.3711 166.244 30 166.244L30 88.0355Z"
        fill={BRAND}
      />
      <Circle cx="115.632" cy="127.14" r="39.1041" fill={BRAND} />
      <Circle cx="201.265" cy="127.14" r="39.1041" fill={BRAND} />
    </Svg>
  );
}

function statusLabel(status: string): string {
  return INVOICE_STATUS[status as InvoiceStatus]?.label ?? status;
}

/** Professional A4 invoice document mirroring the HTML portal view. */
function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const { company } = data;
  return (
    <Document title={`Factura ${data.fullNumber}`} author="doscientos">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <BrandMark />
              <Text style={styles.brandName}>doscientos</Text>
            </View>
            {data.invoiceType ? <Text style={styles.docType}>{data.invoiceType}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.number}>{data.fullNumber}</Text>
            <Text style={styles.status}>{statusLabel(data.status)}</Text>
            {data.issueDate ? (
              <Text style={styles.metaRow}>Emitida: {formatDate(data.issueDate)}</Text>
            ) : null}
            {data.dueDate ? (
              <Text style={styles.metaRow}>Vencimiento: {formatDate(data.dueDate)}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.parties}>
          {company ? (
            <View style={styles.party}>
              <Text style={styles.label}>Emitida por</Text>
              <Text style={styles.partyName}>{company.name ?? "—"}</Text>
              {company.nif ? <Text style={styles.partyLine}>NIF: {company.nif}</Text> : null}
              {company.address ? <Text style={styles.partyLine}>{company.address}</Text> : null}
              {company.iban ? <Text style={styles.partyLine}>IBAN: {company.iban}</Text> : null}
            </View>
          ) : null}
          <View style={styles.party}>
            <Text style={styles.label}>Facturado a</Text>
            <Text style={styles.partyName}>{data.clientName ?? "—"}</Text>
            {data.clientNif ? <Text style={styles.partyLine}>NIF: {data.clientNif}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.cDesc]}>Descripción</Text>
            <Text style={[styles.th, styles.cNum]}>Cant.</Text>
            <Text style={[styles.th, styles.cNum]}>Precio</Text>
            <Text style={[styles.th, styles.cVat]}>IVA</Text>
            <Text style={[styles.th, styles.cAmount]}>Subtotal</Text>
          </View>
          {data.items.length === 0 ? (
            <View style={styles.row}>
              <Text style={[styles.cDesc, { color: FAINT }]}>Sin líneas.</Text>
            </View>
          ) : (
            data.items.map((item, i) => (
              <View key={i} style={styles.row} wrap={false}>
                <Text style={styles.cDesc}>{item.description}</Text>
                <Text style={styles.cNum}>{item.quantity}</Text>
                <Text style={styles.cNum}>{formatEUR(item.unitPrice)}</Text>
                <Text style={styles.cVat}>{item.vatRate}%</Text>
                <Text style={[styles.cAmount, { fontFamily: "Helvetica-Bold" }]}>
                  {formatEUR(item.subtotal)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalLine}>
            <Text style={styles.totalMuted}>Base imponible</Text>
            <Text style={styles.totalMuted}>{formatEUR(data.subtotal)}</Text>
          </View>
          {data.vatBreakdown.map((row) => (
            <View key={row.rate} style={styles.totalLine}>
              <Text style={styles.totalMuted}>
                IVA {row.rate}% sobre {formatEUR(row.base)}
              </Text>
              <Text style={styles.totalMuted}>{formatEUR(row.tax)}</Text>
            </View>
          ))}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandLabel}>{formatEUR(data.total)}</Text>
          </View>
        </View>

        {data.idfact || data.verifactuCsv || data.qrDataUrl ? (
          <View style={styles.fiscal}>
            <View style={styles.fiscalInfo}>
              <Text style={styles.label}>Datos fiscales</Text>
              {data.idfact ? <Text style={styles.mono}>IDFACT: {data.idfact}</Text> : null}
              {data.verifactuCsv ? (
                <Text style={styles.mono}>CSV AEAT: {data.verifactuCsv}</Text>
              ) : null}
            </View>
            {data.qrDataUrl ? (
              <View style={styles.qrWrap}>
                <Image style={styles.qr} src={data.qrDataUrl} />
                <Text style={styles.qrCaption}>Verificar en AEAT</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Factura verificable en la sede electrónica de la AEAT mediante el código QR. Sistema de
            emisión conforme al Reglamento Verifactu (RD 1007/2023). Conserve esta factura conforme
            a la normativa fiscal aplicable.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** Render an invoice snapshot to a PDF buffer suitable for a download response. */
export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoicePdfDocument data={data} />);
}
