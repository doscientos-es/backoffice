import type { Metadata } from 'next'

import { ListPage } from '@/components/layout/list-page'
import { requireUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { escapeIlike, parsePage, parseSortParam, parseStringParam } from '@/lib/utils/search-params'

export const metadata: Metadata = { title: 'Documentos · doscientos' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const DOCUMENT_SORT_COLUMNS = ['name', 'mime_type', 'size_bytes', 'created_at'] as const

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireUser()
  const sp = await searchParams
  const q = parseStringParam(sp, 'q')
  const page = parsePage(sp)
  const { sort, dir } = parseSortParam(sp, DOCUMENT_SORT_COLUMNS, 'created_at', 'desc')
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createServerClient()
  let query = supabase
    .from('attachments')
    .select('id, name, mime_type, size_bytes, created_at', { count: 'exact' })
    .is('deleted_at', null)

  if (q.length > 0) query = query.ilike('name', `%${escapeIlike(q)}%`)

  const ascending = sort !== 'created_at' ? dir !== 'desc' : false
  const { data, error, count } = await query
    .order(sort, { ascending, nullsFirst: false })
    .range(from, to)

  return (
    <ListPage
      title="Documentos"
      empty={q ? 'Sin coincidencias.' : 'Aún no hay documentos.'}
      error={error?.message}
      searchKey="q"
      searchPlaceholder="Buscar por nombre…"
      pagination={{ page, pageSize: PAGE_SIZE, total: count ?? 0 }}
      columns={[
        { key: 'nombre', label: 'Nombre', sortKey: 'name' },
        { key: 'formato', label: 'Formato', sortKey: 'mime_type' },
        { key: 'tamano', label: 'Tamaño', sortKey: 'size_bytes' },
        { key: 'subido', label: 'Subido', sortKey: 'created_at' },
      ]}
      exportFilename="documentos"
      rows={
        data?.map((d) => ({
          id: d.id as string,
          href: `/documents/${d.id}`,
          cells: {
            nombre: { content: d.name as string, value: d.name as string },
            formato: {
              content: (d.mime_type as string | null) ?? null,
              value: (d.mime_type as string | null) ?? '',
            },
            tamano: {
              content: d.size_bytes ? `${Math.ceil(Number(d.size_bytes) / 1024)} KB` : null,
              value: d.size_bytes ? Math.ceil(Number(d.size_bytes) / 1024) : 0,
            },
            subido: { content: formatDate(d.created_at as string), value: d.created_at as string },
          },
        })) ?? []
      }
    />
  )
}
