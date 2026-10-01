import { Button, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const BRAND = '#2A4227'
const BODY: React.CSSProperties = {
  color: '#3f3f46',
  fontSize: 14,
  lineHeight: '22px',
  margin: '0 0 14px',
}

export type ProjectKickoffEmailProps = {
  clientName: string
  projectName: string
  portalUrl: string
  appUrl: string
  message?: string
  language?: 'es' | 'ca' | 'en'
}

export function ProjectKickoffEmail({
  clientName,
  projectName,
  portalUrl,
  appUrl,
  message,
  language = 'es',
}: ProjectKickoffEmailProps) {
  const copy = language === 'ca' ? CA : language === 'en' ? EN : ES
  return (
    <EmailLayout preview={`${copy.preview} ${projectName}`} appUrl={appUrl}>
      <Text style={{ ...BODY, color: '#171717', fontSize: 20, fontWeight: 600 }}>
        {copy.greeting}, {clientName}
      </Text>
      <Text style={BODY}>
        {copy.intro} <strong>{projectName}</strong>. {copy.intro2}
      </Text>
      {message ? <Text style={{ ...BODY, fontStyle: 'italic' }}>{message}</Text> : null}
      <Text style={BODY}>{copy.portalInfo}</Text>
      <Button
        href={portalUrl}
        style={{
          backgroundColor: BRAND,
          borderRadius: 8,
          boxSizing: 'border-box',
          color: '#ffffff',
          display: 'block',
          fontSize: 14,
          fontWeight: 600,
          padding: '14px 0',
          textAlign: 'center',
          textDecoration: 'none',
          width: '100%',
        }}
      >
        {copy.cta}
      </Button>
      <Text style={{ ...BODY, color: '#71717a', fontSize: 12, margin: '18px 0 0' }}>
        {copy.privacy}
      </Text>
    </EmailLayout>
  )
}

const ES = {
  preview: 'Tu proyecto ya está en marcha:',
  greeting: 'Arrancamos',
  intro: 'El proyecto',
  intro2:
    'ya está en marcha. Hemos preparado un espacio privado para que puedas seguir su evolución desde un único lugar.',
  portalInfo:
    'En el portal encontrarás el progreso, las próximas fechas, las tareas compartidas y un canal para enviarnos solicitudes.',
  cta: 'Ver seguimiento del proyecto',
  privacy: 'Este enlace es privado. No lo compartas con personas ajenas al proyecto.',
}
const CA = {
  preview: 'El teu projecte ja està en marxa:',
  greeting: 'Comencem',
  intro: 'El projecte',
  intro2:
    'ja està en marxa. Hem preparat un espai privat perquè en puguis seguir l’evolució des d’un únic lloc.',
  portalInfo:
    'Al portal trobaràs el progrés, les properes dates, les tasques compartides i un canal per enviar-nos sol·licituds.',
  cta: 'Veure el seguiment del projecte',
  privacy: 'Aquest enllaç és privat. No el comparteixis amb persones alienes al projecte.',
}
const EN = {
  preview: 'Your project is underway:',
  greeting: 'We are getting started',
  intro: 'The project',
  intro2:
    'is underway. We have prepared a private space where you can follow its progress in one place.',
  portalInfo:
    'In the portal you will find progress, upcoming dates, shared tasks, and a channel to send us requests.',
  cta: 'View project progress',
  privacy: 'This link is private. Do not share it with anyone outside the project.',
}
