import { Hr, Section, Text } from '@react-email/components'

import { EmailLayout } from './email-layout'

const FONT = "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export type QuarterlyAdvisorEmailProps = {
  quarterLabel: string
  periodLabel: string
  invoiceCount: number
  invoiceTotal: string
  expenseCount: number
  expenseTotal: string
  attachmentCount: number
  /** Files that exceeded the email size limit; available through the Drive links in the Excel. */
  skippedFiles?: string[]
  message?: string
  appUrl: string
}

/** Quarterly register sent to the tax advisor with the Excel and supporting documents attached. */
export function QuarterlyAdvisorEmail({
  quarterLabel,
  periodLabel,
  invoiceCount,
  invoiceTotal,
  expenseCount,
  expenseTotal,
  attachmentCount,
  skippedFiles = [],
  message,
  appUrl,
}: QuarterlyAdvisorEmailProps) {
  return (
    <EmailLayout preview={`Documentación fiscal ${quarterLabel}`} appUrl={appUrl}>
      <Text style={headingStyle}>Documentación del {quarterLabel}</Text>
      <Text style={bodyStyle}>
        Os enviamos el registro trimestral de doscientos ({periodLabel}): un Excel con el resumen,
        las facturas emitidas y los gastos, junto con {attachmentCount} documento
        {attachmentCount === 1 ? '' : 's'} adjunto{attachmentCount === 1 ? '' : 's'}.
      </Text>
      {message ? <Text style={{ ...bodyStyle, fontStyle: 'italic' }}>{message}</Text> : null}
      <Section style={summaryStyle}>
        <Text style={rowStyle}>
          Facturas emitidas: <strong>{invoiceCount}</strong> · {invoiceTotal}
        </Text>
        <Text style={{ ...rowStyle, marginBottom: 0 }}>
          Gastos: <strong>{expenseCount}</strong> · {expenseTotal}
        </Text>
      </Section>
      {skippedFiles.length > 0 ? (
        <Text style={bodyStyle}>
          Por tamaño no se han adjuntado: {skippedFiles.join(', ')}. Tenéis los enlaces de Drive en
          la hoja «Gastos» del Excel.
        </Text>
      ) : null}
      <Hr style={{ borderColor: '#e4e4e7', margin: '28px 0 16px' }} />
      <Text style={{ ...bodyStyle, color: '#a1a1aa', fontSize: 12, marginBottom: 0 }}>
        Si falta algún documento, responded a este email y os lo hacemos llegar.
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

const summaryStyle: React.CSSProperties = {
  backgroundColor: '#fafafa',
  border: '1px solid #e4e4e7',
  borderRadius: 8,
  margin: '16px 0',
  padding: '12px 16px',
}

const rowStyle: React.CSSProperties = { ...bodyStyle, margin: '0 0 4px' }
