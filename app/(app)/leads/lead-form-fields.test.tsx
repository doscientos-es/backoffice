import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LeadFormFields } from './lead-form-fields'

afterEach(cleanup)

describe('LeadFormFields origin field', () => {
  it('does not ask for the origin when creating a lead', () => {
    render(<LeadFormFields />)

    expect(screen.queryByLabelText('Origen')).toBeNull()
  })

  it('keeps the origin available when editing a lead', () => {
    render(<LeadFormFields includeSource defaults={{ source: 'Referencia' }} />)

    expect(screen.getByLabelText('Origen')).toBeTruthy()
  })
})
