import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LeadNotesDialog } from './lead-notes-dialog'

describe('LeadNotesDialog', () => {
  it('uses a readable, constrained width for expanded notes', () => {
    render(<LeadNotesDialog notes="Notas largas del lead" />)

    fireEvent.click(screen.getByRole('button', { name: 'Ver nota completa' }))

    expect(screen.getByRole('dialog').className).toContain('sm:max-w-xl')
  })
})
