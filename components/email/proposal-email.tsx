import { Button, Hr, Section, Text } from "@react-email/components";

import { EmailLayout } from "./email-layout";

const BRAND = "#2A4227";
const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export type ProposalEmailSpec = {
  /** Display title of the technical-spec document. */
  title: string;
  /** Absolute URL to /p/spec/[token]. */
  url: string;
};

export type ProposalEmailProps = {
  /** Recipient client name, e.g. "Acme S.L." */
  clientName: string;
  /** Proposal title, e.g. "Desarrollo web corporativo" */
  proposalTitle: string;
  /** Proposal number, e.g. "P-2026-007" */
  proposalNumber: string;
  /** Formatted total string, e.g. "8.500,00 €" */
  total: string;
  /** Formatted valid-until date, e.g. "30 de junio de 2026". Optional. */
  validUntil?: string;
  /** Absolute URL to the public portal proposal page */
  portalUrl: string;
  /** Absolute URL to the deck/presentation page. Optional. */
  deckUrl?: string;
  /** Absolute base URL of the app (for logo resolution) */
  appUrl: string;
  /** Optional custom message from the sender */
  message?: string;
  /** Optional client-visible technical specs to surface as secondary CTAs. */
  specs?: ProposalEmailSpec[];
  language?: "es" | "ca" | "en";
};

/**
 * Transactional email sent to the client when a proposal is shared.
 *
 * Usage:
 *   const html = await renderEmail(<ProposalEmail {...props} />);
 *   await sendEmail({ ..., subject: `Propuesta ${proposalNumber}`, html });
 */
export function ProposalEmail({
  clientName,
  proposalTitle,
  proposalNumber,
  total,
  validUntil,
  portalUrl,
  deckUrl,
  appUrl,
  message,
  specs,
  language = "es",
}: ProposalEmailProps) {
  const hasSpecs = Array.isArray(specs) && specs.length > 0;
  const copy = language === "ca" ? CA : language === "en" ? EN : ES;
  return (
    <EmailLayout
      preview={`${copy.proposal} ${proposalNumber} · ${proposalTitle} · ${total}`}
      appUrl={appUrl}
    >
      {/* Greeting */}
      <Text style={headingStyle}>
        {copy.greeting}, {clientName}
      </Text>
      <Text style={bodyStyle}>
        {copy.intro} <strong>{proposalTitle}</strong>. {copy.details}
      </Text>

      {/* Optional custom message */}
      {message ? <Text style={{ ...bodyStyle, fontStyle: "italic" }}>{message}</Text> : null}

      {/* Summary card */}
      <Section
        style={{
          backgroundColor: "#f4f4f5",
          borderRadius: 8,
          padding: "16px 20px",
          margin: "24px 0",
        }}
      >
        <Text style={{ ...labelStyle, marginBottom: 4 }}>{copy.proposal}</Text>
        <Text style={{ ...valueStyle, marginBottom: 12 }}>{proposalTitle}</Text>
        <Text style={{ ...labelStyle, marginBottom: 4 }}>{copy.reference}</Text>
        <Text style={{ ...valueStyle, marginBottom: 12 }}>{proposalNumber}</Text>
        <Text style={{ ...labelStyle, marginBottom: 4 }}>{copy.total}</Text>
        <Text style={{ ...valueStyle, marginBottom: validUntil ? 12 : 0 }}>{total}</Text>
        {validUntil ? (
          <>
            <Text style={{ ...labelStyle, marginBottom: 4 }}>{copy.validUntil}</Text>
            <Text style={{ ...valueStyle, marginBottom: 0 }}>{validUntil}</Text>
          </>
        ) : null}
      </Section>

      {/* CTA */}
      <Button
        href={portalUrl}
        style={{
          display: "block",
          width: "100%",
          backgroundColor: BRAND,
          color: "#ffffff",
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 600,
          textAlign: "center",
          textDecoration: "none",
          borderRadius: 8,
          padding: "14px 0",
          boxSizing: "border-box",
        }}
      >
        {copy.viewProposal}
      </Button>

      {deckUrl ? (
        <Button
          href={deckUrl}
          style={{
            display: "block",
            width: "100%",
            backgroundColor: "#ffffff",
            color: BRAND,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            textDecoration: "none",
            border: `1px solid ${BRAND}`,
            borderRadius: 8,
            padding: "12px 0",
            boxSizing: "border-box",
            marginTop: 8,
          }}
        >
          {copy.deck}
        </Button>
      ) : null}

      {hasSpecs ? (
        <>
          <Hr style={{ borderColor: "#e4e4e7", margin: "28px 0 16px" }} />
          <Text style={{ ...labelStyle, marginBottom: 8 }}>{copy.specifications}</Text>
          <Text style={{ ...bodyStyle, marginBottom: 12 }}>{copy.specificationsIntro}</Text>
          {specs!.map((spec) => (
            <Button
              key={spec.url}
              href={spec.url}
              style={{
                display: "block",
                width: "100%",
                backgroundColor: "#ffffff",
                color: BRAND,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                textAlign: "center",
                textDecoration: "none",
                border: `1px solid ${BRAND}`,
                borderRadius: 8,
                padding: "12px 0",
                boxSizing: "border-box",
                marginBottom: 8,
              }}
            >
              {copy.open} {spec.title}
            </Button>
          ))}
        </>
      ) : null}

      <Hr style={{ borderColor: "#e4e4e7", margin: "28px 0 16px" }} />
      <Text style={{ ...bodyStyle, color: "#a1a1aa", fontSize: 12 }}>{copy.questions}</Text>
    </EmailLayout>
  );
}

const ES = {
  proposal: "Propuesta",
  greeting: "Hola",
  intro: "Te enviamos nuestra propuesta",
  details: "Puedes revisarla, hacer preguntas y aceptarla o rechazarla desde el siguiente enlace.",
  reference: "Referencia",
  total: "Importe total",
  validUntil: "Válida hasta",
  viewProposal: "Ver propuesta",
  deck: "Ver presentación",
  specifications: "Documentación técnica",
  specificationsIntro: "Adjuntamos también la documentación técnica de este proyecto:",
  open: "Abrir",
  questions: "Si tienes cualquier pregunta o necesitas ajustes, responde a este email.",
};
const CA = {
  proposal: "Proposta",
  greeting: "Hola",
  intro: "T’enviem la nostra proposta",
  details: "Pots revisar-la, fer preguntes i acceptar-la o rebutjar-la des de l’enllaç següent.",
  reference: "Referència",
  total: "Import total",
  validUntil: "Vàlida fins al",
  viewProposal: "Veure proposta",
  deck: "Veure presentació",
  specifications: "Documentació tècnica",
  specificationsIntro: "T’adjuntem també la documentació tècnica d’aquest projecte:",
  open: "Obrir",
  questions: "Si tens cap pregunta o necessites algun ajust, respon a aquest correu.",
};
const EN = {
  proposal: "Proposal",
  greeting: "Hello",
  intro: "We are sending you our proposal",
  details: "You can review it, ask questions, and accept or decline it using the link below.",
  reference: "Reference",
  total: "Total",
  validUntil: "Valid until",
  viewProposal: "View proposal",
  deck: "View presentation",
  specifications: "Technical documentation",
  specificationsIntro: "We have also attached the technical documentation for this project:",
  open: "Open",
  questions: "If you have any questions or need changes, reply to this email.",
};

// ── Shared styles ────────────────────────────────────────────────────────────
const headingStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 20,
  fontWeight: 600,
  color: "#111111",
  margin: "0 0 12px",
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
  fontWeight: 600,
  color: "#71717a",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: 0,
};

const valueStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 14,
  fontWeight: 600,
  color: "#111111",
  margin: 0,
};
