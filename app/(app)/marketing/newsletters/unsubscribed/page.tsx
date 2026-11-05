import Link from 'next/link'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { getSuppressedMarketingContacts } from '@/lib/marketing/email-marketing'

export const metadata = { title: 'Bajas de email marketing - doscientos' }
export const dynamic = 'force-dynamic'

const labels: Record<string, string> = {
  unsubscribed: 'Baja',
  bounced: 'Rebotado',
  complained: 'Queja',
}
const path = '/marketing/newsletters/unsubscribed'

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireUser()
  const value = Number((await searchParams).page)
  const page = Number.isSafeInteger(value) && value > 0 && value <= 100000 ? value : 1
  const { contacts, count, pageSize } = await getSuppressedMarketingContacts(page)
  const pages = Math.max(1, Math.ceil(count / pageSize))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bajas y bloqueos"
        description="Estas direcciones están excluidas de los emails comerciales de todas las listas."
        breadcrumbs={[
          { label: 'Email marketing', href: '/marketing/newsletters' },
          { label: 'Bajas y bloqueos' },
        ]}
      />
      <Card>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {page > 1 ? 'No hay contactos en esta página.' : 'No hay bajas ni bloqueos.'}
            </p>
          ) : (
            <div className="divide-y">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium break-all">{contact.name || contact.email}</p>
                    {contact.name && (
                      <p className="text-sm break-all text-muted-foreground">{contact.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {contact.unsubscribed_at && (
                      <span className="text-sm text-muted-foreground">
                        {new Intl.DateTimeFormat('es-ES', {
                          dateStyle: 'medium',
                          timeZone: 'Europe/Madrid',
                        }).format(new Date(contact.unsubscribed_at))}
                      </span>
                    )}
                    <Badge variant="warning">{labels[contact.status] ?? contact.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(pages > 1 || page > 1) && (
            <div className="flex items-center justify-between border-t p-4 text-sm">
              <span>
                Página {page} de {pages}
              </span>
              <div className="flex gap-4">
                {page > 1 && (
                  <Link className="underline" href={`${path}?page=${Math.min(page - 1, pages)}`}>
                    Anterior
                  </Link>
                )}
                {page < pages && (
                  <Link className="underline" href={`${path}?page=${page + 1}`}>
                    Siguiente
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
