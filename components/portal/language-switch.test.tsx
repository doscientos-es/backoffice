import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PortalLanguageSwitch } from './language-switch'

const router = { replace: vi.fn() }
let pathname: string
let query: string

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(query),
}))

function selectCatalan() {
  const link = screen.getByRole('link', { name: 'Català' })
  const event = createEvent.click(link)
  event.preventDefault() // Simulate activation without leaving the test document.
  fireEvent(link, event)
  return link
}

describe('PortalLanguageSwitch', () => {
  beforeEach(() => {
    pathname = '/p/proposal/example'
    query = 'lang=es'
    router.replace.mockClear()
    window.localStorage.clear()
  })

  afterEach(() => vi.restoreAllMocks())

  it('honours the link language on a first visit without saving it', () => {
    query = 'lang=en'
    render(<PortalLanguageSwitch />)

    expect(screen.getByRole('link', { name: 'English' }).getAttribute('aria-current')).toBe('true')
    expect(router.replace).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
  })

  it('remembers a manual selection when opening a different public link', () => {
    const proposal = render(<PortalLanguageSwitch />)
    expect(selectCatalan().getAttribute('href')).toBe('/p/proposal/example?lang=ca')
    proposal.unmount()

    pathname = '/deck/example'
    query = 'lang=en&step=2'
    const deck = render(<PortalLanguageSwitch />)

    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/deck/example?lang=ca&step=2', {
      scroll: false,
    })

    query = 'lang=ca&step=2'
    deck.rerender(<PortalLanguageSwitch />)
    expect(screen.getByRole('link', { name: 'Català' }).getAttribute('aria-current')).toBe('true')
    expect(router.replace).toHaveBeenCalledTimes(1)
  })

  it('falls back to a supported browser language without saving it', () => {
    query = 'lang=invalid'
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['fr-FR', 'en-GB'])
    render(<PortalLanguageSwitch />)

    expect(router.replace).toHaveBeenCalledExactlyOnceWith('/p/proposal/example?lang=en', {
      scroll: false,
    })
    expect(window.localStorage.length).toBe(0)
  })

  it('keeps language links usable when storage is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('Storage access denied')
    })
    render(<PortalLanguageSwitch />)

    expect(selectCatalan().getAttribute('href')).toBe('/p/proposal/example?lang=ca')
    expect(router.replace).not.toHaveBeenCalled()
  })
})
