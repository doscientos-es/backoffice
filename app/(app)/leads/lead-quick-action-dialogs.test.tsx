import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CallDigestDialog } from './call-digest-dialog'
import { QWhatsAppDialog } from './lead-quick-action-dialogs'

vi.mock('./whatsapp-composer', () => ({
  WhatsAppComposer: () => <p>Compositor de WhatsApp</p>,
}))

describe('CallDigestDialog', () => {
  it('keeps each channel selector labeled and touch-sized', () => {
    render(
      <CallDigestDialog
        leadId="00000000-0000-4000-8000-000000000001"
        leadName="María López"
        leadEmail="maria@example.com"
        leadPhone="600 111 222"
        senderName="Ana"
        open
        onOpenChange={vi.fn()}
        draftKey={0}
      />,
    )

    for (const label of ['Email', 'WhatsApp', 'Ambos']) {
      expect(screen.getByRole('button', { name: label }).className).toContain('min-h-11')
    }
  })
})

describe('QWhatsAppDialog', () => {
  it('closes when interacting outside the dialog', async () => {
    render(
      <QWhatsAppDialog
        leadId="00000000-0000-4000-8000-000000000001"
        leadName="María López"
        leadEmail="maria@example.com"
        leadPhone="600 111 222"
        senderName="Ana"
        aiEnabled
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Preparar' }))
    expect(screen.getByRole('dialog', { name: 'Preparar WhatsApp' })).toBeTruthy()

    fireEvent.click(document.querySelector('[data-slot=dialog-overlay]') as HTMLElement)

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Preparar WhatsApp' })).toBeNull(),
    )
  })
})
