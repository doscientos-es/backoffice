import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { TimelineItem } from '@/lib/proposals/timeline'

import { TimelineEditor } from './timeline-editor'

function Editor() {
  const [items, setItems] = useState<TimelineItem[]>([])
  return (
    <>
      <TimelineEditor items={items} onChange={setItems} locked={false} />
      <output>{JSON.stringify(items)}</output>
    </>
  )
}

describe('timeline editor', () => {
  it('adds, edits and removes a milestone', () => {
    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: /Añadir hito/ }))
    fireEvent.change(screen.getByLabelText('Qué haremos'), { target: { value: 'Diseño' } })
    fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByLabelText('Fin (incluido)'), { target: { value: '2026-12-07' } })
    expect(screen.getByRole('status').textContent).toContain('2026-12-07')
    fireEvent.click(screen.getByRole('button', { name: 'Añadir semana siguiente' }))
    expect(screen.getByRole('status').textContent).toContain('2026-12-08')
    expect(screen.getByRole('status').textContent).toContain('2026-12-14')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar hito 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar hito 1' }))
    expect(screen.getByRole('status').textContent).toBe('[]')
  })
})
