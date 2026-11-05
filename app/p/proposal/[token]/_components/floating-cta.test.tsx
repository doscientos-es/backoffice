import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FloatingCta } from './respond-controls'

vi.mock('../actions', () => ({ trackPortalEngagement: vi.fn() }))

let intersect: IntersectionObserverCallback
const observe = vi.fn()
const disconnect = vi.fn()

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }
      observe = observe
      disconnect = disconnect
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('FloatingCta', () => {
  it('offers a responsive shortcut to the response panel and focuses its action', () => {
    vi.useFakeTimers()
    const { unmount } = render(
      <>
        <FloatingCta totalLabel="Inversión" total="1.000 €" cta="Revisar y aceptar" />
        <div data-proposal-response>
          <button type="button">Aceptar propuesta</button>
        </div>
      </>,
    )
    const button = screen.getByRole('button', { name: 'Revisar y aceptar' })
    const panelButton = screen.getByRole('button', { name: 'Aceptar propuesta' })
    const panel = panelButton.parentElement!
    const scrollIntoView = vi.fn()
    vi.spyOn(panel, 'getClientRects').mockReturnValue([new DOMRect()] as unknown as DOMRectList)
    Object.defineProperty(panel, 'scrollIntoView', { value: scrollIntoView })

    expect(observe).toHaveBeenCalledWith(panel)
    expect(button.parentElement?.parentElement?.className).toContain('lg:inset-x-auto')
    expect(screen.getByText('Inversión').parentElement?.className).toContain('lg:hidden')
    fireEvent.click(button)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    act(() => vi.runAllTimers())
    expect(document.activeElement).toBe(panelButton)
    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('hides the shortcut from pointer, keyboard and assistive technology while the panel is visible', () => {
    render(
      <>
        <FloatingCta totalLabel="Inversión" total="1.000 €" cta="Revisar y aceptar" />
        <div data-proposal-response />
      </>,
    )
    const button = screen.getByRole('button', { name: 'Revisar y aceptar' })
    const bar = button.parentElement!.parentElement!
    const panel = document.querySelector('[data-proposal-response]')!
    const updateVisibility = (isIntersecting: boolean) =>
      act(() => {
        intersect(
          [{ target: panel, isIntersecting } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        )
      })

    updateVisibility(true)
    expect(bar.getAttribute('aria-hidden')).toBe('true')
    expect(bar.className).toContain('pointer-events-none')
    expect(button.tabIndex).toBe(-1)

    updateVisibility(false)
    expect(bar.getAttribute('aria-hidden')).toBe('false')
    expect(button.tabIndex).toBe(0)
  })
})
