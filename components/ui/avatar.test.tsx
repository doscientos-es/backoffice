import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Avatar, AvatarFallback, AvatarImage } from './avatar'

class TestImage extends EventTarget {
  static instances: TestImage[] = []
  static cached = false
  private source = ''
  complete = false
  naturalWidth = 0

  constructor() {
    super()
    TestImage.instances.push(this)
  }

  get src() {
    return this.source
  }

  set src(value: string) {
    this.source = value
    this.complete = false
    this.naturalWidth = 0
    if (TestImage.cached) {
      this.complete = true
      this.naturalWidth = 64
    }
  }

  load() {
    this.complete = true
    this.naturalWidth = 64
    this.dispatchEvent(new Event('load'))
  }

  fail() {
    this.complete = true
    this.naturalWidth = 0
    this.dispatchEvent(new Event('error'))
  }
}

function Photo({ src }: { src?: string }) {
  return (
    <Avatar size="sm">
      <AvatarImage src={src} alt="Synthetic member" />
      <AvatarFallback>SM</AvatarFallback>
    </Avatar>
  )
}

describe('avatar image and fallback', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    TestImage.instances = []
    TestImage.cached = false
  })

  it('replaces initials with the loaded photo, never rendering them alongside the image', async () => {
    vi.stubGlobal('Image', TestImage)
    render(<Photo src="/synthetic-member.jpg" />)
    expect(screen.getByText('SM')).toBeTruthy()

    act(() => {
      TestImage.instances.at(-1)!.load()
    })

    expect(await screen.findByRole('img', { name: 'Synthetic member' })).toBeTruthy()
    expect(screen.queryByText('SM')).toBeNull()
  })

  it('shows a cached photo without leaving initials visible', async () => {
    TestImage.cached = true
    vi.stubGlobal('Image', TestImage)
    render(<Photo src="/cached-member.jpg" />)

    expect(await screen.findByRole('img', { name: 'Synthetic member' })).toBeTruthy()
    expect(screen.queryByText('SM')).toBeNull()
  })

  it('uses initials when the photo is missing or fails to load', () => {
    vi.stubGlobal('Image', TestImage)
    const view = render(<Photo />)
    expect(screen.getByText('SM')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()

    view.rerender(<Photo src="/missing-member.jpg" />)
    act(() => {
      TestImage.instances.at(-1)!.fail()
    })
    expect(screen.getByText('SM')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('recovers after a failed URL is replaced by a working photo', async () => {
    vi.stubGlobal('Image', TestImage)
    const view = render(<Photo src="/missing-member.jpg" />)
    act(() => {
      TestImage.instances.at(-1)!.fail()
    })

    view.rerender(<Photo src="/replacement-member.jpg" />)
    act(() => {
      TestImage.instances.at(-1)!.load()
    })

    expect((await screen.findByRole('img', { name: 'Synthetic member' })).getAttribute('src')).toBe(
      '/replacement-member.jpg',
    )
    expect(screen.queryByText('SM')).toBeNull()

    view.rerender(<Photo />)
    expect(await screen.findByText('SM')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
