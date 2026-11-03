import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SectionNav } from './respond-controls'

vi.mock('../actions', () => ({ trackPortalEngagement: vi.fn() }))

const items = [
  { id: 'contexto', label: 'Contexto' },
  { id: 'inversion', label: 'Inversión' },
]

let intersect: IntersectionObserverCallback
let resize: ResizeObserverCallback
let secondWidth = 110
const disconnectIntersection = vi.fn()
const disconnectResize = vi.fn()

beforeEach(() => {
  secondWidth = 110
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }
      observe() {}
      disconnect = disconnectIntersection
    },
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback
      }
      observe() {}
      disconnect = disconnectResize
    },
  )
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.getAttribute('href') === '#inversion' ? 100 : 4
    },
  )
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.getAttribute('href') === '#inversion' ? secondWidth : 90
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('SectionNav', () => {
  it('moves the indicator with the active section and resizes it when labels change', () => {
    const { container, unmount } = render(
      <>
        <SectionNav items={items} />
        <section id="contexto" />
        <section id="inversion" />
      </>,
    )
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    const context = screen.getByRole('link', { name: 'Contexto' })
    const investment = screen.getByRole('link', { name: 'Inversión' })
    const indicator = nav.querySelector<HTMLElement>('span[aria-hidden="true"]')!
    expect(context.getAttribute('aria-current')).toBe('true')
    expect(indicator.style.transform).toBe('translateX(4px)')
    expect(indicator.style.width).toBe('90px')
    expect(indicator.className).toContain('motion-safe:transition-')

    vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 160 } as DOMRect)
    vi.spyOn(investment, 'getBoundingClientRect').mockReturnValue({
      left: 170,
      right: 280,
    } as DOMRect)
    act(() => {
      intersect(
        [
          {
            target: container.querySelector('#inversion')!,
            isIntersecting: true,
            boundingClientRect: { top: 100 },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })
    expect(context.hasAttribute('aria-current')).toBe(false)
    expect(investment.getAttribute('aria-current')).toBe('true')
    expect(indicator.style.transform).toBe('translateX(100px)')
    expect(indicator.style.width).toBe('110px')
    expect(nav.scrollLeft).toBe(120)

    secondWidth = 130
    act(() => resize([], {} as ResizeObserver))
    expect(indicator.style.width).toBe('130px')
    unmount()
    expect(disconnectIntersection).toHaveBeenCalled()
    expect(disconnectResize).toHaveBeenCalled()
  })

  it('omits navigation when fewer than two sections are available', () => {
    render(<SectionNav items={items.slice(0, 1)} />)
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
