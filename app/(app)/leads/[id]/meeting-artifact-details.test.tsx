import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadMeetingArtifact } from './meeting-artifact-actions'
import { MeetingArtifactDetails } from './meeting-artifact-details'

vi.mock('./meeting-artifact-actions', () => ({ loadMeetingArtifact: vi.fn() }))

const props = {
  leadId: '00000000-0000-4000-8000-000000000001',
  interactionId: '00000000-0000-4000-8000-000000000002',
  kind: 'transcript' as const,
  documentUrl: 'https://docs.google.com/document/d/test-document/view',
}

function toggle(element: HTMLDetailsElement, open: boolean) {
  element.open = open
  fireEvent(element, new Event('toggle'))
}

beforeEach(() => vi.mocked(loadMeetingArtifact).mockReset())
afterEach(cleanup)

describe('MeetingArtifactDetails', () => {
  it('fetches only when opened and reuses the document on subsequent openings', async () => {
    vi.mocked(loadMeetingArtifact).mockResolvedValue({
      ok: true,
      text: 'Ana: Enviar propuesta',
      truncated: false,
    })
    const { container } = render(<MeetingArtifactDetails {...props} />)
    expect(loadMeetingArtifact).not.toHaveBeenCalled()
    const details = container.querySelector('details') as HTMLDetailsElement
    toggle(details, true)
    await screen.findByText('Ana: Enviar propuesta')
    toggle(details, false)
    toggle(details, true)
    expect(loadMeetingArtifact).toHaveBeenCalledOnce()
    expect(loadMeetingArtifact).toHaveBeenCalledWith({
      leadId: props.leadId,
      interactionId: props.interactionId,
      kind: 'transcript',
    })
  })

  it('lets the user retry a failed request and shows truncation with the original link', async () => {
    vi.mocked(loadMeetingArtifact)
      .mockResolvedValueOnce({ ok: false, error: 'No disponible' })
      .mockResolvedValueOnce({ ok: true, text: 'Texto recuperado', truncated: true })
    const { container } = render(<MeetingArtifactDetails {...props} />)
    toggle(container.querySelector('details') as HTMLDetailsElement, true)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText('Texto recuperado')
    expect(screen.getByText(/Transcripción recortada/)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Ver documento completo en Google' }).getAttribute('href'),
    ).toBe(props.documentUrl)
    expect(loadMeetingArtifact).toHaveBeenCalledTimes(2)
  })

  it('prevents duplicate requests while a document is loading', async () => {
    let finish!: (value: Awaited<ReturnType<typeof loadMeetingArtifact>>) => void
    vi.mocked(loadMeetingArtifact).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { container } = render(<MeetingArtifactDetails {...props} kind="notes" />)
    const details = container.querySelector('details') as HTMLDetailsElement
    toggle(details, true)
    toggle(details, false)
    toggle(details, true)
    expect(loadMeetingArtifact).toHaveBeenCalledOnce()
    finish({ ok: true, text: 'Notas completas', truncated: false })
    await waitFor(() => expect(screen.getByText('Notas completas')).toBeTruthy())
  })
})
