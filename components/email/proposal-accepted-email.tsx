import { Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

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
}

export function ProposalAcceptedEmail({
  clientName,
  proposalTitle,
  appUrl,
  language = 'es',
}: ProposalAcceptedEmailProps) {
  const copy = language === 'ca' ? CA : language === 'en' ? EN : ES
  return (
    <EmailLayout preview={`${copy.preview} ${proposalTitle}`} appUrl={appUrl}>
      <Text style={{ ...BODY, color: '#171717', fontSize: 20, fontWeight: 600 }}>
        {copy.greeting}, {clientName}
      </Text>
      <Text style={BODY}>
        {copy.first} <strong>{proposalTitle}</strong> {copy.second}
      </Text>
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
  portal:
    'Once your project space is ready, you will receive another email with a private link. There you can check progress and dates, and send us requests.',
  questions:
    'There is nothing else you need to do for now. If you have questions, reply to this email.',
}
