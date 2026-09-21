import { buildBookingUrl } from '@/lib/recovery/utils'

export type WhatsAppLead = { id: string; name: string; email: string | null }

function firstName(name: string | null | undefined): string {
  const trimmed = name?.trim()
  return trimmed ? (trimmed.split(/\s+/)[0] ?? trimmed) : 'cliente'
}

export function buildLeadWhatsAppMessage(
  lead: WhatsAppLead,
  senderName: string,
  calendarLink: string | undefined,
): string {
  const bookingUrl = buildBookingUrl(calendarLink, lead)
  return [
    `Hola, ${lead.name.split(' ')[0] || lead.name}. Soy ${senderName || 'el equipo'}, de Doscientos.`,
    'He intentado llamarte porque rellenaste un formulario en uno de nuestros anuncios de Meta.',
    'Me gustaría entender qué necesitas y ver si podemos ayudarte.',
    bookingUrl
      ? `Puedes contarme brevemente por aquí o, si lo prefieres, agendar una reunión: ${bookingUrl}`
      : 'Puedes contarme brevemente por aquí y te respondo en cuanto pueda.',
    '¿Qué te resulta más cómodo?',
  ].join('\n\n')
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  const internationalPhone = digits.length === 9 ? `34${digits}` : digits
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`
}

export function buildInvoiceWhatsAppMessage(
  clientName: string | null | undefined,
  invoiceNumber: string,
  portalUrl: string,
): string {
  return [
    `Hola ${firstName(clientName)}, te comparto la factura ${invoiceNumber}.`,
    `Puedes consultarla y descargarla desde aquí:\n${portalUrl}`,
    'Si tienes cualquier duda, escríbeme.',
  ].join('\n\n')
}

export function buildProposalWhatsAppMessage(
  recipientName: string | null | undefined,
  proposalNumber: string,
  portalUrl: string,
): string {
  return [
    `Hola ${firstName(recipientName)}, te comparto la propuesta ${proposalNumber}.`,
    `Puedes revisarla con calma desde este enlace:\n${portalUrl}`,
    'Si te parece, comentamos cualquier duda.',
  ].join('\n\n')
}

export function buildProjectWhatsAppMessage(
  clientName: string | null | undefined,
  projectName: string,
  portalUrl: string,
): string {
  return [
    `Hola ${firstName(clientName)}, ya hemos empezado con ${projectName}.`,
    `Puedes seguir el proyecto desde el portal del cliente:\n${portalUrl}`,
    'Si necesitas cualquier cosa, escríbeme por aquí.',
  ].join('\n\n')
}
