import type { ListCell, ListColumn, ListRow } from './list-page'

function cellValue(cell?: ListCell): string | number {
  if (cell?.value != null) return cell.value
  return typeof cell?.content === 'string' || typeof cell?.content === 'number' ? cell.content : ''
}

export function rowLabel<Data, Key extends string>(
  columns: ListColumn<Key>[],
  row: ListRow<Data, Key>,
): string {
  const key = columns[0]?.key
  return (key && String(cellValue(row.cells[key]))) || 'fila'
}

/** CSV follows named columns, so moving a column also moves its export value. */
export function listCSV<Data, Key extends string>(
  columns: ListColumn<Key>[],
  rows: ListRow<Data, Key>[],
): string {
  const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  return [
    columns.map((column) => escapeCsv(column.label)),
    ...rows.map((row) => columns.map((column) => escapeCsv(cellValue(row.cells[column.key])))),
  ]
    .map((values) => values.join(','))
    .join('\r\n')
}

export function exportToCSV<Data, Key extends string>(
  columns: ListColumn<Key>[],
  rows: ListRow<Data, Key>[],
  filename: string,
) {
  const blob = new Blob([`\uFEFF${listCSV(columns, rows)}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
