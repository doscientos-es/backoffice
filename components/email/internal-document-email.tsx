import { Hr, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export type InternalDocumentEmailProps = {
  recipientName?: string
  documentName: string
  appUrl: string
  message?: string
}

/** Email sent with the selected internal document as an attachment. */
export function InternalDocumentEmail({
  recipientName,
  documentName,
  appUrl,
  message,
}: InternalDocumentEmailProps) {
  return (
    <EmailLayout preview={`Documento adjunto · ${documentName}`} appUrl={appUrl}>
      <Text style={headingStyle}>Hola{recipientName ? `, ${recipientName}` : ''}</Text>
      <Text style={bodyStyle}>
        Te enviamos el documento <strong>{documentName}</strong> adjunto a este email.
      </Text>
      {message ? <Text style={{ ...bodyStyle, fontStyle: 'italic' }}>{message}</Text> : null}
      <Hr style={{ borderColor: '#e4e4e7', margin: '28px 0 16px' }} />
      <Text style={{ ...bodyStyle, color: '#a1a1aa', fontSize: 12, marginBottom: 0 }}>
        Si tienes cualquier duda, responde a este email y te atenderemos encantados.
      </Text>
    </EmailLayout>
  )
}

const headingStyle: React.CSSProperties = {
  color: '#111111',
  fontFamily: FONT,
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  margin: '0 0 12px',
}

const bodyStyle: React.CSSProperties = {
  color: '#3f3f46',
  fontFamily: FONT,
  fontSize: 14,
  lineHeight: '22px',
  margin: '0 0 12px',
}
