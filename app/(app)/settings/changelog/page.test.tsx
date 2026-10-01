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
})
