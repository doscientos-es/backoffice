import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { parseMeetingInfo } from '@/lib/leads/meeting-info'

import { MeetingDetailsSection } from './meeting-details-section'

vi.mock('./meeting-artifact-details', () => ({ MeetingArtifactDetails: () => null }))
vi.mock('./meeting-insights', () => ({
  MeetingNextSteps: () => null,
  MeetingNoShowAlert: () => null,
}))

describe('MeetingDetailsSection', () => {
  it('renders the summary as Markdown and shows each participant name only once', () => {
    const info = parseMeetingInfo({
      meet_artifacts: {
        processed_at: '2026-11-01T11:00:00Z',
        duration_minutes: 75,
        participants: [
          { name: 'Stella', start: '2026-11-01T10:00:00Z' },
          { name: 'stella', start: '2026-11-01T10:10:00Z' },
          { name: 'Pol Gubau Amores' },
          { name: 'Gerard Martinez' },
        ],
        summary: '## Necesidades\n- **Prioridad**: propuesta\n- Revisar presupuesto',
      },
    })
    render(
      <MeetingDetailsSection
        info={info}
        interactionId="interaction-1"
        leadId="lead-1"
        leadEmail={null}
        canEdit={false}
      />,
    )

    expect(screen.getByText('Quién estuvo en la llamada · 75 min')).toBeTruthy()
    expect(screen.getAllByText(/stella/i)).toHaveLength(1)
    expect(screen.getByText('Pol Gubau Amores')).toBeTruthy()
    expect(screen.getByText('Gerard Martinez')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Necesidades' })).toBeTruthy()
    expect(screen.getByText('Prioridad').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
