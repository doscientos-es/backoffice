import { Button, Hr, Section, Text } from "@react-email/components";

import type { LeadResource } from "@/lib/integrations/lead-resources";

import { EmailLayout } from "./email-layout";

const BRAND = "#2A4227";
const BRAND_LIGHT = "#edf3ec";
const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const CASES_URL = "https://doscientos.es/projects?ref=email-confirmacion";
const CASES_URL_CA = "https://doscientos.es/ca/projects?ref=email-confirmacion";
const CALCULATOR_URL =
  "https://doscientos.es/automatizar-excel?ref=email-confirmacion#calculadora-coste";
const CALCULATOR_URL_CA =
  "https://doscientos.es/ca/automatizar-excel?ref=email-confirmacion#calculadora-coste";

export type LeadConfirmationEmailProps = {
  /** Lead's first name or full name, used in the greeting. */
  leadName: string;
  /** Absolute base URL of the app (for logo resolution). */
  appUrl: string;
  /** Contextual resource selected from the lead source/ref. */
  resource: LeadResource;
  calculatorCost?: string | null;
  calculatorHours?: string | null;
  language?: "ca" | "es" | "en";
};

/**
 * Confirmation email sent to the lead right after their request is received.
 *
 * Usage:
 *   const html = await renderEmail(LeadConfirmationEmail({ leadName, appUrl, resource }));
 *   await sendEmail({ fromName: "doscientos", fromAlias: "hola", subject: "...", html });
 */
export function LeadConfirmationEmail({
  leadName,
  appUrl,
  resource,
  calculatorCost,
  calculatorHours,
  language = "es",
}: LeadConfirmationEmailProps) {
  const firstName = leadName.split(" ")[0] ?? leadName;
  const hasCalculatorSummary = Boolean(calculatorCost || calculatorHours);
  const copy = language === "ca" ? CATALAN : language === "en" ? ENGLISH : SPANISH;

  return (
    <EmailLayout preview={`${firstName}, ${copy.preview}`} appUrl={appUrl}>
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
          {copy.title}
        </Text>
      </Section>

      {/* Greeting */}
      <Text style={headingStyle}>
        {copy.greeting}, {firstName}!
      </Text>
      <Text style={bodyStyle}>{copy.intro}</Text>

      <Section style={aboutStyle}>
        <Text style={{ ...labelStyle, color: BRAND, marginBottom: 8 }}>{copy.about}</Text>
        <Text style={{ ...stepBodyStyle, marginBottom: 16 }}>{copy.aboutBody}</Text>
        <Button href={language === "ca" ? CASES_URL_CA : CASES_URL} style={primaryButtonStyle}>
          {copy.cases}
        </Button>
        <Text style={{ ...stepBodyStyle, margin: "12px 0 8px" }}>{copy.calculatorIntro}</Text>
        <Button
          href={language === "ca" ? CALCULATOR_URL_CA : CALCULATOR_URL}
          style={secondaryButtonStyle}
        >
          {copy.calculator}
        </Button>
      </Section>

      {hasCalculatorSummary ? (
        <Section
          style={{
            backgroundColor: "#f4f4f5",
            borderRadius: 8,
            padding: "16px 20px",
            margin: "20px 0 8px",
          }}
        >
          <Text style={{ ...labelStyle, color: BRAND, marginBottom: 8 }}>
            {copy.calculatorResult}
          </Text>
          {calculatorHours ? (
            <Text style={stepBodyStyle}>
              {copy.hours}: {calculatorHours} h
            </Text>
          ) : null}
          {calculatorCost ? (
            <Text style={{ ...stepBodyStyle, marginTop: 4 }}>
              {copy.cost}: {calculatorCost} EUR
            </Text>
          ) : null}
        </Section>
      ) : null}

      {resource.slug !== "calculadora-coste-oculto" ? (
        <Section
          style={{
            backgroundColor: BRAND_LIGHT,
            borderRadius: 8,
            padding: "18px 20px",
            margin: "20px 0 24px",
          }}
        >
          <Text style={{ ...labelStyle, color: BRAND, marginBottom: 8 }}>{copy.resource}</Text>
          <Text style={stepTitleStyle}>{resource.title}</Text>
          <Text style={{ ...stepBodyStyle, marginBottom: 16 }}>{resource.description}</Text>
          <Button href={resource.href} style={primaryButtonStyle}>
            {resource.cta}
          </Button>
        </Section>
      ) : null}

      <Hr style={{ borderColor: "#e4e4e7", margin: "24px 0" }} />

      {/* What happens next */}
      <Text
        style={{
          ...labelStyle,
          color: BRAND,
          marginBottom: 16,
        }}
      >
        {copy.next}
      </Text>

      {(language === "ca" ? STEPS_CA : language === "en" ? STEPS_EN : STEPS_ES).map((step, i) => (
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
      <Text style={{ ...bodyStyle, color: "#71717a" }}>{copy.questions}</Text>
      <Text style={{ ...bodyStyle, fontWeight: 600, color: BRAND, margin: 0 }}>
        {copy.signature}
      </Text>
    </EmailLayout>
  );
}

const SPANISH = {
  preview: "hemos recibido tu solicitud y te contactaremos muy pronto",
  title: "Solicitud recibida",
  greeting: "Hola",
  intro:
    "Hemos recibido tus datos a través de uno de nuestros formularios y ya están en manos de nuestro equipo. Nos pondremos en contacto contigo en las próximas horas laborables.",
  about: "Qué hacemos",
  aboutBody:
    "En doscientos creamos software a medida, automatizamos procesos y desarrollamos webs para que las empresas ahorren tiempo, reduzcan errores y trabajen con más control.",
  cases: "Ver casos de éxito",
  calculatorIntro:
    "También puedes estimar cuánto cuesta al año ese trabajo manual que se repite en tu equipo.",
  calculator: "Probar la calculadora de costes",
  calculatorResult: "Resultado de tu calculadora",
  hours: "Horas estimadas al año",
  cost: "Coste anual estimado",
  resource: "Recurso recomendado",
  next: "¿Qué pasa ahora?",
  questions:
    "Si tienes cualquier pregunta mientras tanto, responde directamente a este email y te atenderemos encantados.",
  signature: "— El equipo de doscientos",
};
const CATALAN = {
  preview: "hem rebut la teva sol·licitud i et contactarem ben aviat",
  title: "Sol·licitud rebuda",
  greeting: "Hola",
  intro:
    "Hem rebut les teves dades a través d’un dels nostres formularis i ja són en mans del nostre equip. Ens posarem en contacte amb tu durant les pròximes hores laborables.",
  about: "Què fem",
  aboutBody:
    "A doscientos creem programari a mida, automatitzem processos i desenvolupem webs perquè les empreses estalviïn temps, redueixin errors i treballin amb més control.",
  cases: "Veure casos d’èxit",
  calculatorIntro:
    "També pots calcular quant costa cada any la feina manual que es repeteix al teu equip.",
  calculator: "Provar la calculadora de costos",
  calculatorResult: "Resultat de la calculadora",
  hours: "Hores estimades a l’any",
  cost: "Cost anual estimat",
  resource: "Recurs recomanat",
  next: "Què passarà ara?",
  questions:
    "Si mentrestant tens cap pregunta, respon directament a aquest correu i t’atendrem encantats.",
  signature: "— L’equip de doscientos",
};
const ENGLISH = {
  preview: "we received your request and will be in touch soon",
  title: "Request received",
  greeting: "Hello",
  intro:
    "We have received your details through one of our forms, and our team is reviewing them. We will get in touch during the next business hours.",
  about: "What we do",
  aboutBody:
    "At doscientos, we build custom software, automate processes, and develop websites so businesses can save time, reduce errors, and work with greater control.",
  cases: "See our work",
  calculatorIntro: "You can also estimate the annual cost of repetitive manual work in your team.",
  calculator: "Try the cost calculator",
  calculatorResult: "Your calculator result",
  hours: "Estimated hours per year",
  cost: "Estimated annual cost",
  resource: "Recommended resource",
  next: "What happens next?",
  questions:
    "If you have any questions, reply directly to this email and we will be happy to help.",
  signature: "— The doscientos team",
};

const STEPS_ES = [
  {
    title: "Entendemos tu caso",
    body: "Revisamos la información para que la primera conversación sea concreta y útil.",
  },
  {
    title: "Te contactamos",
    body: "Te llamamos o escribimos para agendar una primera conversación sin compromiso.",
  },
  {
    title: "Acordamos el siguiente paso",
    body: "Si podemos ayudarte, te explicamos una propuesta clara de alcance, plazos y prioridades.",
  },
];
const STEPS_CA = [
  {
    title: "Entenem el teu cas",
    body: "Revisem la informació perquè la primera conversa sigui concreta i útil.",
  },
  {
    title: "Ens posem en contacte",
    body: "Et trucarem o t’escriurem per concertar una primera conversa sense compromís.",
  },
  {
    title: "Acordem el pas següent",
    body: "Si et podem ajudar, t’explicarem una proposta clara d’abast, terminis i prioritats.",
  },
];
const STEPS_EN = [
  {
    title: "We understand your case",
    body: "We review the information so our first conversation is concrete and useful.",
  },
  {
    title: "We get in touch",
    body: "We will call or email you to arrange an initial no-obligation conversation.",
  },
  {
    title: "We agree on the next step",
    body: "If we can help, we will explain a clear proposal covering scope, timing, and priorities.",
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

const aboutStyle: React.CSSProperties = {
  backgroundColor: "#fafafa",
  border: "1px solid #e4e4e7",
  borderRadius: 8,
  padding: "18px 20px",
  margin: "20px 0 24px",
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: BRAND,
  color: "#ffffff",
  borderRadius: 8,
  fontFamily: FONT,
  fontSize: 13,
  fontWeight: 700,
  padding: "10px 14px",
  textDecoration: "none",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  backgroundColor: "#ffffff",
  color: BRAND,
  border: `1px solid ${BRAND}`,
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
