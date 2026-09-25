import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireUser }))

import ChangelogSettingsPage, { metadata } from './page'

describe('changelog in settings', () => {
  it('requires authentication and renders the published snapshot', async () => {
    const html = renderToStaticMarkup(await ChangelogSettingsPage())
    expect(requireUser).toHaveBeenCalledOnce()
    expect(metadata.title).toContain('Novedades')
    expect(html).toContain('Mejoras en el trabajo con leads')
    expect(html).toContain('preguntas de descubrimiento')
    expect(html).toContain('2026-09-24')
  })
})
