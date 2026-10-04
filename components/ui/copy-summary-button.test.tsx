import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('sileo', () => ({ sileo: { error: vi.fn(), success: vi.fn() } }))

import { CopySummaryButton } from './copy-summary-button'

const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

afterEach(() => {
  if (originalShare) Object.defineProperty(navigator, 'share', originalShare)
  else Reflect.deleteProperty(navigator, 'share')
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('CopySummaryButton', () => {
  it('shares the entity summary and internal deep link natively', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })

    render(<CopySummaryButton lines={['Cliente: Acme']} urlPath="/clients/client-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartir ficha' }))

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: 'Ficha de Doscientos',
        text: `Cliente: Acme\n→ ${window.location.origin}/clients/client-1`,
        url: `${window.location.origin}/clients/client-1`,
      }),
    )
  })

  it('copies the entity summary when the native share API is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Reflect.deleteProperty(navigator, 'share')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<CopySummaryButton lines={['Lead: María']} urlPath="/leads/lead-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartir ficha' }))

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `Lead: María\n→ ${window.location.origin}/leads/lead-1`,
      ),
    )
  })
})
