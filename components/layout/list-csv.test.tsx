import { describe, expect, it } from 'vitest'

import { listCSV } from './list-csv'

const rows = [
  {
    id: 'lead',
    cells: {
      nombre: { content: <strong>Ana</strong>, value: 'Ana "Pérez"' },
      campana: { content: <span>Campaña de otoño</span>, value: 'Campaña de otoño' },
      estado: { content: <span>Ganado</span>, value: 'won' },
      importe: { content: '0 €', value: 0 },
    },
  },
]

describe('listCSV', () => {
  it('keeps values under their named headers when columns are reordered', () => {
    expect(
      listCSV(
        [
          { key: 'estado', label: 'Estado' },
          { key: 'campana', label: 'Campaña' },
        ],
        rows,
      ),
    ).toBe('"Estado","Campaña"\r\n"won","Campaña de otoño"')
  })
  it('escapes quotes and preserves zero values', () => {
    expect(
      listCSV(
        [
          { key: 'nombre', label: 'Nombre' },
          { key: 'importe', label: 'Importe' },
        ],
        rows,
      ),
    ).toBe('"Nombre","Importe"\r\n"Ana ""Pérez""","0"')
  })
})
