import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InternalDocRowActions } from './internal-doc-row-actions'

describe('InternalDocRowActions', () => {
  it('links directly to the protected download route', () => {
    render(
      <InternalDocRowActions
        id="doc-1"
        name="Guía.pdf"
        mimeType="application/pdf"
        previewUrl="https://storage.example/preview"
      />,
    )

    const download = screen.getByRole('link', { name: 'Descargar Guía.pdf' })
    expect(download.getAttribute('href')).toBe('/api/internal-docs/doc-1/download')
    expect(download.hasAttribute('download')).toBe(true)
  })

  it('opens a dialog with a preview of the selected document', () => {
    render(
      <InternalDocRowActions
        id="doc-1"
        name="Guía.pdf"
        mimeType="application/zip"
        previewUrl="https://storage.example/preview"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Vista previa Guía.pdf' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Preview no disponible para este tipo de archivo.')).toBeTruthy()
    expect(screen.getByText('application/zip')).toBeTruthy()
  })
})
