import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireUser }))

import changelog from '@/lib/changelog.json'

import ChangelogSettingsPage, { metadata } from './page'

describe('changelog in settings', () => {
  it('requires authentication and renders the published snapshot', async () => {
    const html = renderToStaticMarkup(await ChangelogSettingsPage())
    expect(requireUser).toHaveBeenCalledOnce()
    expect(metadata.title).toContain('Novedades')
    const [latest] = changelog.releases
    if (!latest) throw new Error('changelog.json has no releases')
    expect(html).toContain(latest.title)
    expect(html).toContain(latest.date)
  })

  it('paginates releases and clamps out-of-range pages', async () => {
    const releases = changelog.releases
    const pageCount = Math.ceil(releases.length / 5)
    const render = async (page?: string) =>
      renderToStaticMarkup(
        await ChangelogSettingsPage({ searchParams: Promise.resolve(page ? { page } : {}) }),
      )
    const first = await render()
    if (pageCount <= 1) {
      expect(first).not.toContain('Paginación de novedades')
      return
    }
    expect(first).toContain('Siguiente')
    expect(first).not.toContain('Anterior')
    const last = await render('999')
    expect(last).toContain(`Página ${pageCount} de ${pageCount}`)
    expect(last).toContain('Anterior')
    expect(last).not.toContain('Siguiente')
    expect(last).not.toContain(releases[0]?.title)
  })
})
