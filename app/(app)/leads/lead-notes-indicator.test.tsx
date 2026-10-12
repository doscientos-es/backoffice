import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeadNotesIndicator } from './lead-notes-indicator'

describe('LeadNotesIndicator', () => {
  it('shows a clear marker when a lead has a note', () => {
    render(<LeadNotesIndicator notes="Quiere revisar una app de IA" />)

    expect(screen.getByText('Nota')).toBeTruthy()
  })

  it('does not show a marker for missing or blank notes', () => {
    const { rerender } = render(<LeadNotesIndicator notes="   " />)
    expect(screen.queryByText('Nota')).toBeNull()

    rerender(<LeadNotesIndicator notes={null} />)
    expect(screen.queryByText('Nota')).toBeNull()
  })
})
