// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { renderEmail } from '@/lib/email/render'

import { LeadConfirmationEmail } from './lead-confirmation-email'

const resource = {
  slug: 'calculadora-coste-oculto',
  title: 'Calculadora del coste del trabajo manual',
  description: 'Calcula el coste anual de un proceso repetitivo.',
  href: 'https://example.test/calculadora',
  cta: 'Abrir calculadora',
}

describe('LeadConfirmationEmail', () => {
  it('explains the service and links cases and the cost calculator', async () => {
    const html = await renderEmail(
      LeadConfirmationEmail({
        leadName: 'Persona Ejemplo',
        appUrl: 'https://example.test',
        resource,
        calculatorCost: '12500',
        calculatorHours: '420',
      }),
    )

    expect(html).toContain('Hola')
    expect(html).toContain('Persona')
    expect(html).toContain('próximas horas laborables')
    expect(html).toContain('software a medida')
    expect(html).toContain('Ver casos de éxito')
    expect(html).toContain('/projects?ref=email-confirmacion')
    expect(html).toContain('Probar la calculadora de costes')
    expect(html).toContain('Resultado de tu calculadora')
    expect(html).toContain('Horas estimadas al año')
    expect(html).toContain('420')
    expect(html).toContain('Coste anual estimado')
    expect(html).toContain('12500')
  })

  it('renders the Catalan confirmation copy and localized links', async () => {
    const html = await renderEmail(
      LeadConfirmationEmail({
        leadName: 'Persona Prova',
        appUrl: 'https://example.test',
        resource,
        language: 'ca',
      }),
    )
    expect(html).toContain('Sol·licitud rebuda')
    expect(html).toContain('Hem rebut les teves dades')
    expect(html).toContain('/ca/projects?ref=email-confirmacion')
    expect(html).toContain('Què passarà ara?')
  })
})
