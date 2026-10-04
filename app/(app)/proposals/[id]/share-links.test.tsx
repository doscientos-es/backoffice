import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ShareLinks } from './share-links'

const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

afterEach(() => {
  if (originalShare) Object.defineProperty(navigator, 'share', originalShare)
  else Reflect.deleteProperty(navigator, 'share')
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('ShareLinks', () => {
  it('shares the public proposal URL with its title using the native share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })

    render(
      <ShareLinks
        token="public-token"
        proposalTitle="Automatización comercial"
        portalViewedAt={null}
        deckViewedAt={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Compartir enlace de propuesta' }))

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: 'Automatización comercial',
        text: 'Te comparto propuesta: Automatización comercial',
        url: `${window.location.origin}/p/proposal/public-token`,
      }),
    )
  })

  it('does not allow sharing draft proposal links', () => {
    render(
      <ShareLinks
        token="public-token"
        proposalTitle="Borrador"
        portalViewedAt={null}
        deckViewedAt={null}
        isDraft
      />,
    )

    expect(screen.getByRole('button', { name: 'Compartir enlace de propuesta' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('copies the proposal link when the native share API is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Reflect.deleteProperty(navigator, 'share')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <ShareLinks
        token="public-token"
        proposalTitle="Automatización comercial"
        portalViewedAt={null}
        deckViewedAt={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Compartir enlace de propuesta' }))

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/p/proposal/public-token`),
    )
  })
})
