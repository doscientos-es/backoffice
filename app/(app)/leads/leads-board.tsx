import { TriangleAlert } from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty-state'
import { LEAD_BOARD_LIMIT, type LeadListResult } from '@/lib/leads/types'
import type { MemberOption } from '@/lib/members/queries'

import { LeadCreateDialog } from './lead-create-dialog'
import { LeadsKanban } from './leads-kanban'

/**
 * Kanban body. It awaits the leads query started by the page, so the header and
 * filters can stream first and only the board skeleton waits for the data.
 */
export async function LeadsBoard({
  leadsPromise,
  hasFilters,
  canEdit,
  aiEnabled,
  googleEnabled,
  members,
}: {
  leadsPromise: Promise<LeadListResult>
  hasFilters: boolean
  canEdit: boolean
  aiEnabled: boolean
  googleEnabled: boolean
  members: MemberOption[]
}) {
  const { leads, count, error } = await leadsPromise
  const boardCapped = count > LEAD_BOARD_LIMIT

  return (
    <>
      {!error && hasFilters ? (
        <output aria-live="polite" className="shrink-0 text-sm text-muted-foreground">
          {count === 1 ? '1 lead encontrado' : `${count} leads encontrados`}
        </output>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="px-0 pt-0">
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>
                  {hasFilters
                    ? 'No hay resultados con esta búsqueda y filtros'
                    : 'Aún no hay leads.'}
                </EmptyTitle>
                {hasFilters ? (
                  <EmptyDescription>
                    Prueba con parte del nombre, email o teléfono, o quita los filtros activos.
                  </EmptyDescription>
                ) : null}
              </EmptyHeader>
              <EmptyContent>
                {hasFilters ? (
                  <Link
                    href="/leads"
                    className="text-sm font-medium text-primary underline underline-offset-4"
                  >
                    Limpiar búsqueda y filtros
                  </Link>
                ) : (
                  <LeadCreateDialog />
                )}
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {boardCapped ? (
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
              <TriangleAlert className="size-4 shrink-0" />
              <span>
                Se muestran los primeros <strong>{LEAD_BOARD_LIMIT}</strong> leads. Usa los filtros
                para acotar los resultados.
              </span>
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <LeadsKanban
              leads={leads}
              canEdit={canEdit}
              aiEnabled={aiEnabled}
              googleEnabled={googleEnabled}
              members={members}
            />
          </div>
        </div>
      )}
    </>
  )
}
