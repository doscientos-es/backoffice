import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import changelog from '@/lib/changelog.json'
import { parsePage } from '@/primitives/lib/search-params'

export const metadata: Metadata = { title: 'Novedades · Ajustes · doscientos' }

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  )

const PAGE_SIZE = 5

export default async function ChangelogSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
} = {}) {
  await requireUser()
  const total = changelog.releases.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(parsePage((await searchParams) ?? {}), pageCount)
  const releases = changelog.releases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageHref = (target: number) =>
    target <= 1 ? '/settings/changelog' : `/settings/changelog?page=${target}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Novedades"
        description="Los cambios recientes del backoffice, explicados sin tecnicismos."
      />
      {releases.length ? (
        <ol className="flex flex-col gap-5" aria-label="Historial de novedades">
          {releases.map((release) => (
            <li key={`${release.date}-${release.title}`}>
              <Card>
                <CardHeader>
                  <time dateTime={release.date} className="text-sm text-muted-foreground">
                    {formatDate(release.date)}
                  </time>
                  <CardTitle className="text-xl">{release.title}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                  {release.sections.map((section) => (
                    <section key={section.title} aria-label={section.title}>
                      <h2 className="mb-3 font-semibold">{section.title}</h2>
                      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                        {section.items.map((item) => (
                          <li key={item} className="break-words">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm">Pronto compartiremos novedades.</CardContent>
        </Card>
      )}
      {pageCount > 1 ? (
        <nav
          aria-label="Paginación de novedades"
          className="flex items-center justify-between gap-4"
        >
          <p className="text-sm text-muted-foreground">
            Página {page} de {pageCount}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page - 1)} rel="prev">
                  Anterior
                </Link>
              </Button>
            ) : null}
            {page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page + 1)} rel="next">
                  Siguiente
                </Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
