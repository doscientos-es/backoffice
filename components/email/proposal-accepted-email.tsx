import { Button, Section, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const BRAND = '#2A4227'
const FONT_STACK = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const BODY: React.CSSProperties = {
  color: '#3f3f46',
  fontSize: 14,
  lineHeight: '22px',
  margin: '0 0 14px',
}

export type ProposalAcceptedEmailProps = {
  clientName: string
  proposalTitle: string
  appUrl: string
  language?: 'es' | 'ca' | 'en'
  /** Electronic acceptance evidence, confirmed to the signer (LSSI art. 28). */
  signature?: { signerName: string; acceptedAt: string; documentHash: string } | null
  signedPdfUrl?: string | null
}

export function ProposalAcceptedEmail({
  clientName,
  proposalTitle,
  appUrl,
  language = 'es',
  signature = null,
  signedPdfUrl = null,
}: ProposalAcceptedEmailProps) {
  const copy = language === 'ca' ? CA : language === 'en' ? EN : ES
  const acceptedAt = signature
    ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : `${language}-ES`, {
        dateStyle: 'long',
        timeStyle: 'medium',
        timeZone: 'Europe/Madrid',
      }).format(new Date(signature.acceptedAt))
    : null
  return (
    <EmailLayout preview={`${copy.preview} ${proposalTitle}`} appUrl={appUrl}>
      <Text style={{ ...BODY, color: '#171717', fontSize: 20, fontWeight: 600 }}>
        {copy.greeting}, {clientName}
      </Text>
      <Text style={BODY}>
        {copy.first} <strong>{proposalTitle}</strong> {copy.second}
      </Text>
      {signature ? (
        <Section
          style={{
            backgroundColor: '#f4f4f5',
            borderRadius: 8,
            padding: '12px 16px',
            margin: '0 0 14px',
          }}
        >
          <Text style={{ ...BODY, fontWeight: 600, margin: '0 0 6px' }}>{copy.evidenceTitle}</Text>
          <Text style={{ ...BODY, fontSize: 13, margin: '0 0 4px' }}>
            {copy.signer}: {signature.signerName}
          </Text>
          <Text style={{ ...BODY, fontSize: 13, margin: '0 0 4px' }}>
            {copy.date}: {acceptedAt} (Europe/Madrid)
          </Text>
          <Text
            style={{ ...BODY, fontSize: 11, margin: 0, wordBreak: 'break-all', color: '#71717a' }}
          >
            SHA-256: {signature.documentHash}
          </Text>
        </Section>
      ) : null}
      {signedPdfUrl ? (
        <Button
          href={signedPdfUrl}
          style={{
            display: 'block',
            width: '100%',
            backgroundColor: BRAND,
            color: '#ffffff',
            fontFamily: FONT_STACK,
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
            textDecoration: 'none',
            borderRadius: 8,
            padding: '14px 0',
            boxSizing: 'border-box',
            marginBottom: 14,
          }}
        >
          {copy.download}
        </Button>
      ) : null}
      <Text style={BODY}>{copy.portal}</Text>
      <Text style={{ ...BODY, color: '#71717a', fontSize: 12, marginBottom: 0 }}>
        {copy.questions}
      </Text>
    </EmailLayout>
  )
}

const ES = {
  preview: 'Hemos recibido tu aprobación para',
  greeting: 'Gracias',
  first: 'Hemos recibido la aprobación de la propuesta',
  second: 'y ya estamos preparando el arranque del proyecto.',
  evidenceTitle: 'Confirmación de la firma electrónica',
  signer: 'Firmante',
  date: 'Fecha y hora',
  download: 'Descargar la propuesta firmada',
  portal:
    'En cuanto el espacio de seguimiento esté listo, recibirás otro email con tu enlace privado. Allí podrás consultar el avance, las fechas y enviarnos solicitudes.',
  questions:
    'No necesitas hacer nada más por ahora. Si tienes alguna pregunta, responde directamente a este email.',
}
const CA = {
  preview: 'Hem rebut la teva aprovació per a',
  greeting: 'Gràcies',
  first: 'Hem rebut l’aprovació de la proposta',
  second: 'i ja estem preparant l’inici del projecte.',
  evidenceTitle: 'Confirmació de la signatura electrònica',
  signer: 'Signant',
  date: 'Data i hora',
  download: 'Descarregar la proposta signada',
  portal:
    'Quan l’espai de seguiment estigui a punt, rebràs un altre correu amb el teu enllaç privat. Hi podràs consultar el progrés, les dates i enviar-nos sol·licituds.',
  questions:
    'Ara no cal que facis res més. Si tens cap pregunta, respon directament a aquest correu.',
}
const EN = {
  preview: 'We received your approval for',
  greeting: 'Thank you',
  first: 'We received your approval of the proposal',
  second: 'and are preparing to get the project started.',
  evidenceTitle: 'Electronic signature confirmation',
  signer: 'Signed by',
  date: 'Date and time',
  download: 'Download the signed proposal',
  portal:
    'Once your project space is ready, you will receive another email with a private link. There you can check progress and dates, and send us requests.',
  questions:
    'There is nothing else you need to do for now. If you have questions, reply to this email.',
}
