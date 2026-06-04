import "server-only";

import { type InvoiceStatus, INVOICE_STATUS } from "@/lib/status";
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
  status: { marginTop: 2, fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  metaRow: { marginTop: 4, fontSize: 8, color: MUTED },
  parties: { flexDirection: "row", marginTop: 28, gap: 24 },
  party: { flex: 1 },
  label: { fontSize: 7, color: FAINT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
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
