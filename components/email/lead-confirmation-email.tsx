import { Hr, Section, Text } from "@react-email/components";
import { EmailLayout } from "./email-layout";

const BRAND = "#2A4227";
const BRAND_LIGHT = "#edf3ec";
const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export type LeadConfirmationEmailProps = {
  /** Lead's first name or full name, used in the greeting. */
  leadName: string;
  /** Absolute base URL of the app (for logo resolution). */
  appUrl: string;
};

/**
 * Confirmation email sent to the lead right after their request is received.
 *
 * Usage:
 *   const html = await renderEmail(LeadConfirmationEmail({ leadName, appUrl }));
 *   await sendEmail({ fromName: "doscientos", fromAlias: "hola", subject: "...", html });
 */
export function LeadConfirmationEmail({ leadName, appUrl }: LeadConfirmationEmailProps) {
  const firstName = leadName.split(" ")[0] ?? leadName;

  return (
    <EmailLayout preview={`${firstName}, hemos recibido tu solicitud ✓`} appUrl={appUrl}>
      {/* Hero accent band */}
      <Section
        style={{
          backgroundColor: BRAND,
          borderRadius: 10,
          padding: "28px 32px",
          marginBottom: 28,
          textAlign: "center",
        }}
      >
        <Text
          style={{
            fontFamily: FONT,
            fontSize: 36,
            margin: "0 0 8px",
            lineHeight: 1,
          }}
        >
          ✅
        </Text>
        <Text
          style={{
            fontFamily: FONT,
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: "28px",
          }}
        >
          Solicitud recibida
        </Text>
      </Section>

      {/* Greeting */}
      <Text style={headingStyle}>Hola, {firstName}!</Text>
      <Text style={bodyStyle}>
        Hemos recibido tu mensaje y ya está en manos de nuestro equipo. Nos pondremos en contacto
        contigo en las próximas horas.
      </Text>

      <Hr style={{ borderColor: "#e4e4e7", margin: "24px 0" }} />

      {/* What happens next */}
      <Text
        style={{
          ...labelStyle,
          color: BRAND,
          marginBottom: 16,
        }}
      >
        ¿Qué pasa ahora?
      </Text>

      {STEPS.map((step, i) => (
        <Section
          key={step.title}
          style={{
            backgroundColor: i % 2 === 0 ? BRAND_LIGHT : "#fafafa",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 8,
          }}
        >
          <Text style={{ ...stepNumStyle, color: BRAND }}>{String(i + 1).padStart(2, "0")}</Text>
          <Text style={stepTitleStyle}>{step.title}</Text>
          <Text style={stepBodyStyle}>{step.body}</Text>
        </Section>
      ))}

      <Hr style={{ borderColor: "#e4e4e7", margin: "24px 0 16px" }} />
      <Text style={{ ...bodyStyle, color: "#71717a" }}>
        Si tienes cualquier pregunta mientras tanto, responde directamente a este email y te
        atenderemos encantados.
      </Text>
      <Text style={{ ...bodyStyle, fontWeight: 600, color: BRAND, margin: 0 }}>
        — El equipo de doscientos
      </Text>
    </EmailLayout>
  );
}

const STEPS = [
  {
    title: "Revisamos tu solicitud",
    body: "Un miembro de nuestro equipo estudia tu caso y prepara la mejor propuesta para ti.",
  },
  {
    title: "Te contactamos",
    body: "Te llamamos o escribimos para agendar una primera conversación sin compromiso.",
  },
  {
    title: "Empezamos a trabajar",
    body: "Definimos el alcance, los plazos y ponemos manos a la obra.",
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 20,
  fontWeight: 700,
  color: "#111111",
  margin: "0 0 10px",
  letterSpacing: "-0.02em",
};

const bodyStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  color: "#3f3f46",
  lineHeight: "22px",
  margin: "0 0 12px",
};

const labelStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: 0,
};

const stepNumStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  margin: "0 0 2px",
};

const stepTitleStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 13,
  fontWeight: 600,
  color: "#111111",
  margin: "0 0 2px",
};

const stepBodyStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 13,
  color: "#52525b",
  lineHeight: "20px",
  margin: 0,
};
