import type { Metadata } from 'next'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import changelog from '@/lib/changelog.json'

export const metadata: Metadata = { title: 'Novedades · Ajustes · doscientos' }

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  )

export default async function ChangelogSettingsPage() {
  await requireUser()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Novedades"
        description="Los cambios recientes del backoffice, explicados sin tecnicismos."
      />
      {changelog.releases.length ? (
        <ol className="flex flex-col gap-5" aria-label="Historial de novedades">
          {changelog.releases.map((release) => (
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
    </div>
  )
}
