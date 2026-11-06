import { ArrowRight, ContactRound, Layers3, Mail } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getEmailMarketingListContacts,
  type EmailMarketingList,
  type EmailMarketingSequence,
} from '@/lib/marketing/email-marketing'

import { MarketingAnalytics } from './analytics'
import {
  AddContactDialog,
  CreateListDialog,
  CreateSequenceDialog,
  DeleteListDialog,
  ImportContactsDialog,
} from './list-dialogs'
import { EditMarketingDialog, RemoveContactDialog } from './manage-dialogs'
import { CopyUnsubscribeLink, UnsubscribeContactDialog } from './unsubscribe-controls'

const base = '/marketing/newsletters'
const contactStatuses: Record<string, string> = {
  subscribed: 'Suscrito',
  unsubscribed: 'Baja',
  bounced: 'Rebotado',
  complained: 'Queja',
}
export const sequenceStatuses: Record<
  string,
  { label: string; variant: 'neutral' | 'success' | 'warning' }
> = {
  draft: { label: 'Borrador', variant: 'neutral' },
  active: { label: 'Activa', variant: 'success' },
  paused: { label: 'Pausada', variant: 'warning' },
  completed: { label: 'Completada', variant: 'neutral' },
}

export async function MarketingWorkspace({
  lists,
  sequences,
  list,
  page,
  appUrl,
}: {
  lists: EmailMarketingList[]
  sequences: EmailMarketingSequence[]
  list?: EmailMarketingList
  page: number
  appUrl: string
}) {
  if (!list)
    return (
      <>
        <MarketingAnalytics sequences={sequences} />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [ContactRound, 'Listas', lists.length],
            [Layers3, 'Secuencias activas', sequences.filter((s) => s.status === 'active').length],
            [
              Mail,
              'Emails programados',
              sequences.reduce(
                (n, s) => n + s.steps.filter((step) => step.status === 'scheduled').length,
                0,
              ),
            ],
          ].map(([Icon, label, count]) => {
            const IconComponent = Icon as typeof Mail
            return (
              <Card key={label as string} size="sm">
                <CardHeader>
                  <CardDescription className="flex items-center gap-2">
                    <IconComponent className="size-4" />
                    {label as string}
                  </CardDescription>
                  <CardTitle className="text-2xl">{count as number}</CardTitle>
                </CardHeader>
              </Card>
            )
          })}
        </div>
        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Tus listas</h2>
              <p className="text-sm text-muted-foreground">
                Entra en una lista para gestionar sus contactos y secuencias.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`${base}/calendar`}
                className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
              >
                Calendario de envíos
              </Link>
              <Link
                href={`${base}/unsubscribed`}
                className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
              >
                Ver bajas y bloqueos
              </Link>
              <CreateListDialog />
            </div>
          </div>
          {lists.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <ContactRound className="size-8 text-muted-foreground" />
                <p className="font-medium">Empieza creando una lista</p>
                <p className="text-sm text-muted-foreground">
                  Después podrás añadir contactos y preparar tu primera secuencia.
                </p>
                <CreateListDialog />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {lists.map((item) => {
                const related = sequences.filter((sequence) => sequence.list_id === item.id)
                return (
                  <Link
                    key={item.id}
                    href={`${base}?list=${item.id}`}
                    className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Card className="h-full transition-colors hover:border-primary/50">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <ContactRound className="size-5" />
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <CardTitle className="mt-2">{item.name}</CardTitle>
                        <CardDescription>{item.description || 'Sin descripción'}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex gap-4 text-sm text-muted-foreground">
                        <span>
                          {item.contact_count}{' '}
                          {item.contact_count === 1 ? 'contacto activo' : 'contactos activos'}
                        </span>
                        <span>
                          {related.length} {related.length === 1 ? 'secuencia' : 'secuencias'}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </>
    )

  const related = sequences.filter((sequence) => sequence.list_id === list.id)
  const { contacts, count, pageSize } = await getEmailMarketingListContacts(list.id, page)
  const pages = Math.max(1, Math.ceil(count / pageSize))
  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="text-sm text-muted-foreground">{list.description || 'Sin descripción'}</p>
            <p className="mt-2 text-sm">
              <strong>{list.contact_count}</strong>{' '}
              {list.contact_count === 1 ? 'contacto activo' : 'contactos activos'} ·{' '}
              <strong>{related.length}</strong> {related.length === 1 ? 'secuencia' : 'secuencias'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EditMarketingDialog target={{ kind: 'list', value: list }} />
            <AddContactDialog list={list} />
            <ImportContactsDialog list={list} />
            <DeleteListDialog list={list} />
          </div>
        </CardContent>
      </Card>
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Secuencias</h2>
            <p className="text-sm text-muted-foreground">
              Planifica y consulta los correos de esta lista.
            </p>
          </div>
          <CreateSequenceDialog lists={[list]} />
        </div>
        {related.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Layers3 className="size-8 text-muted-foreground" />
              <p className="font-medium">Todavía no hay secuencias</p>
              <p className="text-sm text-muted-foreground">
                Crea una secuencia y añade los emails que quieres programar.
              </p>
              <CreateSequenceDialog lists={[list]} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {related.map((sequence) => {
              const status = sequenceStatuses[sequence.status] ?? sequenceStatuses.draft!
              const next = sequence.steps.find((step) => step.status === 'scheduled')
              return (
                <Link
                  key={sequence.id}
                  href={`${base}?list=${list.id}&sequence=${sequence.id}`}
                  className="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Card className="h-full transition-colors hover:border-primary/50">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <CardTitle>{sequence.name}</CardTitle>
                      <CardDescription>
                        {sequence.steps.length} emails ·{' '}
                        {sequence.steps.filter((step) => step.status === 'sent').length} enviados
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {next ? `Próximo: ${next.subject}` : 'Sin emails pendientes'}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            Contactos <span className="text-muted-foreground">({count})</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Las bajas y rebotes son globales. Solo se envía a contactos suscritos.
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            {contacts.length === 0 ? (
              <div className="grid justify-items-center gap-3 p-8 text-center text-sm text-muted-foreground">
                <p>
                  {page > 1
                    ? 'No hay contactos en esta página.'
                    : 'Esta lista aún no tiene contactos.'}
                </p>
                {page === 1 && <ImportContactsDialog list={list} />}
              </div>
            ) : (
              <div className="divide-y">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium break-all">{contact.name || contact.email}</p>
                      <p className="text-sm break-all text-muted-foreground">
                        {contact.name
                          ? `${contact.email}${contact.company ? ` · ${contact.company}` : ''}`
                          : contact.company || ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={contact.status === 'subscribed' ? 'success' : 'warning'}>
                        {contactStatuses[contact.status] ?? contact.status}
                      </Badge>
                      <EditMarketingDialog target={{ kind: 'contact', value: contact }} />
                      <CopyUnsubscribeLink token={contact.unsubscribe_token} appUrl={appUrl} />
                      {contact.status === 'subscribed' && (
                        <UnsubscribeContactDialog contact={contact} />
                      )}
                      <RemoveContactDialog listId={list.id} contact={contact} />
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
                    <Link
                      className="underline"
                      href={`${base}?list=${list.id}&page=${Math.min(page - 1, pages)}`}
                    >
                      Anterior
                    </Link>
                  )}
                  {page < pages && (
                    <Link className="underline" href={`${base}?list=${list.id}&page=${page + 1}`}>
                      Siguiente
                    </Link>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  )
}
