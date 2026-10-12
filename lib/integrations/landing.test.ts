import { describe, expect, it } from 'vitest'

import { LandingLeadInput, mapLandingToIntake } from './landing'

describe('mapLandingToIntake', () => {
  it('maps form context and server request metadata into the lead intake', () => {
    const parsed = LandingLeadInput.parse({
      name: 'Ana García',
      email: 'ana@example.test',
      message: 'Necesitamos revisar un asistente con IA.',
      landing_path: '/revision-app-ia',
      landing_ref: 'revision-app-ia',
      landing_subject: 'Revisión técnica de app de IA',
      language: 'es',
      first_utm_source: 'newsletter',
      last_utm_campaign: 'ai-review',
      ip: '198.51.100.77',
      userAgent: 'spoofed browser value',
    })

    const intake = mapLandingToIntake(parsed, {
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })

    expect(intake.notes).toContain('Necesitamos revisar un asistente con IA.')
    expect(intake.context).toMatchObject({
      ip: '203.0.113.10',
      device: 'mobile',
      browser: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      landingPath: '/revision-app-ia',
      landingRef: 'revision-app-ia',
      landingSubject: 'Revisión técnica de app de IA',
      language: 'es',
      firstUtmSource: 'newsletter',
      lastUtmCampaign: 'ai-review',
    })
    expect(intake.context?.ip).not.toBe('198.51.100.77')
    expect(intake.context?.browser).not.toBe('spoofed browser value')
  })
})
