import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeTr } from '../_lib/i18n'
import { DevelopmentApproachSection } from './scope-section'

describe('public proposal development approach', () => {
  it.each([undefined, null, '', ' \n '])('renders nothing for empty content: %s', (source) => {
    const { container } = render(<DevelopmentApproachSection source={source} tr={makeTr('es')} />)
    expect(container.innerHTML).toBe('')
  })

  it.each([
    ['es', 'Cómo trabajaremos durante el desarrollo'],
    ['ca', 'Com treballarem durant el desenvolupament'],
    ['en', 'How we will work during development'],
  ] as const)('renders the localized heading and Markdown in %s', (language, heading) => {
    render(
      <DevelopmentApproachSection
        source="**Revisión semanal** con el cliente."
        tr={makeTr(language)}
      />,
    )
    expect(screen.getByRole('heading', { name: heading })).toBeDefined()
    expect(screen.getByText('Revisión semanal').tagName).toBe('STRONG')
    expect(document.getElementById('desarrollo')).not.toBeNull()
  })
})
