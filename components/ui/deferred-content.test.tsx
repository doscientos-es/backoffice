import { act, cleanup, render, screen } from '@testing-library/react'
import { lazy, useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DeferredContent } from './deferred-content'

afterEach(cleanup)

describe('DeferredContent', () => {
  it('does not download inactive content and keeps it mounted after closing', async () => {
    const unmount = vi.fn()
    const load = vi.fn(async () => ({
      default: function Content({ open }: { open: boolean }) {
        useEffect(() => unmount, [])
        return <div>{open ? 'Open drawer' : 'Closed drawer'}</div>
      },
    }))
    const Content = lazy(load)
    const view = (active: boolean) => (
      <DeferredContent active={active}>
        <Content open={active} />
      </DeferredContent>
    )
    const { rerender } = render(view(false))
    expect(load).not.toHaveBeenCalled()

    rerender(view(true))
    expect(await screen.findByText('Open drawer')).toBeDefined()
    expect(load).toHaveBeenCalledTimes(1)

    rerender(view(false))
    expect(screen.getByText('Closed drawer')).toBeDefined()
    expect(unmount).not.toHaveBeenCalled()
    rerender(view(true))
    expect(screen.getByText('Open drawer')).toBeDefined()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('shows loading feedback only while the requested content is active', async () => {
    let finish!: (module: { default: () => null }) => void
    const Content = lazy(
      () =>
        new Promise<{ default: () => null }>((resolve) => {
          finish = resolve
        }),
    )
    const view = (active: boolean) => (
      <DeferredContent active={active}>
        <Content />
      </DeferredContent>
    )
    const { rerender } = render(view(true))
    expect(screen.getByRole('status').textContent).toBe('Abriendo ficha…')
    rerender(view(false))
    expect(screen.queryByRole('status')).toBeNull()
    await act(async () => finish({ default: () => null }))
  })
})
