import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

const BRAND = "#2A4227";
const styles = StyleSheet.create({
  page: { padding: 42, fontFamily: "Helvetica", color: "#18181b", fontSize: 10 },
  brand: { color: BRAND, fontSize: 12, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  eyebrow: { color: BRAND, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, marginBottom: 10, textTransform: "uppercase" },
  title: { fontSize: 27, fontFamily: "Helvetica-Bold", lineHeight: 1.1, marginBottom: 10 },
  subtitle: { color: "#71717a", fontSize: 11, lineHeight: 1.45 },
  section: { marginTop: 26 },
  h2: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  body: { color: "#52525b", fontSize: 10, lineHeight: 1.5 },
  grid: { flexDirection: "row", gap: 10, marginTop: 18 },
  card: { flex: 1, padding: 14, backgroundColor: "#edf3ec", borderRadius: 6 },
  cardLabel: { color: BRAND, fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  value: { color: BRAND, fontSize: 21, fontFamily: "Helvetica-Bold", marginTop: 7 },
  listItem: { flexDirection: "row", gap: 8, marginBottom: 8 },
  bullet: { color: BRAND, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 28, left: 42, right: 42, borderTopWidth: 1, borderColor: "#e4e4e7", paddingTop: 7, color: "#a1a1aa", fontSize: 8 },
});

export type DiagnosticPdfData = { name: string; company: string | null; answers: Record<string, unknown>; metrics: { yearlyHours: number; yearlyCost: number; monthlyHours: number; risk: string; primaryOpportunity: string } };

function DiagnosticDocument({ data }: { data: DiagnosticPdfData }) {
  const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const answerLines = Object.entries(data.answers).filter(([, value]) => value != null && String(value).trim()).slice(0, 8);
  return <Document title={`Diagnóstico ${data.company ?? data.name}`} author="doscientos">
    <Page size="A4" style={styles.page}>
      <Text style={styles.brand}>doscientos</Text>
      <View style={styles.section}><Text style={styles.eyebrow}>Diagnóstico personalizado</Text><Text style={styles.title}>{data.company || data.name}</Text><Text style={styles.subtitle}>Una primera lectura de los procesos que más tiempo pueden estar consumiendo en tu empresa.</Text></View>
      <View style={styles.grid}><View style={styles.card}><Text style={styles.cardLabel}>Horas al año</Text><Text style={styles.value}>{data.metrics.yearlyHours} h</Text></View><View style={styles.card}><Text style={styles.cardLabel}>Coste estimado</Text><Text style={styles.value}>{euro.format(data.metrics.yearlyCost)}</Text></View><View style={styles.card}><Text style={styles.cardLabel}>Oportunidad</Text><Text style={styles.value}>{data.metrics.risk}</Text></View></View>
      <View style={styles.section}><Text style={styles.h2}>Qué hemos detectado</Text><Text style={styles.body}>Con los datos introducidos, el proceso analizado representa aproximadamente {data.metrics.monthlyHours} horas al mes y {euro.format(data.metrics.yearlyCost)} al año. La cifra es orientativa: el coste real también incluye errores, retrasos y oportunidades que no llegan a gestionarse.</Text></View>
      <View style={styles.section}><Text style={styles.h2}>Tu información</Text>{answerLines.map(([key, value]) => <View key={key} style={styles.listItem}><Text style={styles.bullet}>•</Text><Text style={styles.body}>{key}: {String(value)}</Text></View>)}</View>
      <View style={styles.section}><Text style={styles.h2}>Oportunidad prioritaria</Text><Text style={styles.body}>{data.metrics.primaryOpportunity}</Text></View>
      <Text style={styles.footer}>Informe orientativo preparado por doscientos · software a medida para procesos que merecen la pena</Text>
    </Page>
    <Page size="A4" style={styles.page}><Text style={styles.brand}>doscientos</Text><View style={styles.section}><Text style={styles.eyebrow}>Por qué software a medida</Text><Text style={styles.h2}>La herramienta debe adaptarse a tu proceso</Text><Text style={styles.body}>Un software a medida conecta las herramientas que ya usas, hace visibles los estados y automatiza los pasos repetitivos que hoy dependen de copiar, pegar o perseguir información.</Text></View><View style={styles.section}><Text style={styles.h2}>Qué puede mejorar</Text>{["Menos tiempo en tareas repetitivas", "Menos errores y duplicidad de datos", "Más visibilidad para decidir", "Un proceso que puede crecer contigo"].map((item) => <View key={item} style={styles.listItem}><Text style={styles.bullet}>✓</Text><Text style={styles.body}>{item}</Text></View>)}</View><View style={styles.section}><Text style={styles.h2}>Casos reales</Text>{[["Optinergia", "CRM operativo para ordenar contratos, clientes y seguimiento comercial."], ["Cash Móvil Canarias", "Sistema conectado para mejorar catálogo, pedidos y operaciones."], ["IFCO", "Herramienta interna para dar visibilidad y trazabilidad al trabajo." ]].map(([title, description]) => <View key={title} style={{ marginBottom: 9 }}><Text style={{ fontFamily: "Helvetica-Bold", color: BRAND, fontSize: 10 }}>{title}</Text><Text style={styles.body}>{description}</Text></View>)}</View><View style={styles.section}><Text style={styles.h2}>Siguiente paso</Text><Text style={styles.body}>Si esta oportunidad encaja con tu negocio, podemos revisar contigo el proceso real, validar la estimación y decidir si conviene construir, simplificar o no tocarlo todavía.</Text></View><Text style={styles.footer}>doscientos · diagnóstico sin compromiso</Text></Page>
  </Document>;
}

export async function renderDiagnosticPdf(data: DiagnosticPdfData): Promise<Buffer> { return renderToBuffer(<DiagnosticDocument data={data} />); }
