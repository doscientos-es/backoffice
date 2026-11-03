import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { makeTr } from '../_lib/i18n'
import { DemoLink } from './demo-link'

afterEach(cleanup)

describe('DemoLink', () => {
  it.each([
    ['es', 'Ver demo'],
    ['ca', 'Veure demo'],
    ['en', 'View demo'],
  ] as const)('links to the demo in %s', (language, label) => {
    render(<DemoLink url="https://example.test/demo" tr={makeTr(language)} />)
    const link = screen.getByRole('link', { name: new RegExp(label) })
    expect(link.getAttribute('href')).toBe('https://example.test/demo')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it.each([null, '', 'javascript:alert(1)'])('does not render an absent or unsafe URL', (url) => {
    const { container } = render(<DemoLink url={url} tr={makeTr('es')} />)
    expect(container.firstChild).toBeNull()
  })
})
