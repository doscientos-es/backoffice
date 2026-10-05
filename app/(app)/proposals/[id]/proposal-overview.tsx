import { Download, ExternalLink, Eye } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import type { AttachmentItem } from '@/components/ui/attachment-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import { BILLING_CYCLE_LABELS, type BillingCycle } from '@/lib/finance'
import type { EditablePair } from '@/lib/proposals/key-points'
import type { MaintenanceOffer } from '@/lib/proposals/maintenance'
import { recurringAmount } from '@/lib/proposals/recurring'
import type { PaymentPlanItem, ScopeModule } from '@/lib/proposals/scope'
import { formatDate, formatEUR } from '@/lib/utils'

type Item = {
  id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  subtotal: number
  billing_cycle: string | null
}

type TeamMember = { id: string; name: string; job_title: string | null }

function formatAttachmentSize(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

type Props = {
  canSeePrices?: boolean
  subtotal: number
  taxAmount: number
  total: number
  validUntil: string | null
  paymentPlan: PaymentPlanItem[]
  paymentTerms: string | null
  items: Item[]
  scopeModules: ScopeModule[]
  contextMarkdown: string | null
  problemSolutionPairs: EditablePair[]
  deliverables: string | null
  acceptanceCriteria: string | null
  notes: string | null
  terms: string | null
  changeManagementTerms: string | null
  legalTerms: string | null
  maintenanceOffer: MaintenanceOffer | null
  maintenanceSelectedPlanId: string | null
  attachments: AttachmentItem[]
  team: TeamMember[]
  mainContent?: ReactNode
  sidebarTop?: ReactNode
  sidebar?: ReactNode
}

/** Read-only, scannable proposal view; actions intentionally live outside it. */
export function ProposalOverview({
  canSeePrices = true,
  subtotal,
  taxAmount,
  total,
  validUntil,
  paymentPlan,
  paymentTerms,
  items,
  scopeModules,
  contextMarkdown,
  problemSolutionPairs,
  deliverables,
  acceptanceCriteria,
  notes,
  terms,
  changeManagementTerms,
  legalTerms,
  maintenanceOffer,
  maintenanceSelectedPlanId,
  attachments,
  team,
  mainContent,
  sidebarTop,
  sidebar,
}: Props) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.8fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        {canSeePrices ? (
          <Card>
            <CardHeader>
              <CardTitle>Inversión y condiciones</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Inversión inicial · antes de IVA</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{formatEUR(subtotal)}</p>
                  <div className="mt-3 flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>IVA aplicable</span>
                    <span className="tabular-nums">{formatEUR(taxAmount)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 border-t border-border pt-2 text-xs font-medium">
                    <span>Total previsto con IVA</span>
                    <span className="tabular-nums">{formatEUR(total)}</span>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">Válida hasta</p>
                  <p className="mt-1 text-lg font-semibold">{formatDate(validUntil)}</p>
                </div>
              </div>
              {paymentPlan.length > 0 ? (
                <ul className="divide-y rounded-lg border border-border text-sm">
                  {paymentPlan.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <span>{item.title}</span>
                      <span className="text-right font-medium tabular-nums">
                        {item.percentage} % · {formatEUR((total * item.percentage) / 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {paymentTerms ? <Markdown source={paymentTerms} /> : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Información económica</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Los importes y las partidas económicas están restringidos a tu rol.
            </CardContent>
          </Card>
        )}

        {canSeePrices ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Partidas</CardTitle>
              {scopeModules.length > 0 ? (
                <Button variant="ghost" size="xs" asChild>
                  <Link href="#proposal-scope">Ver módulos</Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y divide-border text-sm">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-4 px-6 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{item.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.quantity} × {formatEUR(item.unit_price)} · IVA {item.vat_rate} %
                        {item.billing_cycle && item.billing_cycle !== 'none'
                          ? ` · ${BILLING_CYCLE_LABELS[item.billing_cycle as BillingCycle] ?? item.billing_cycle}`
                          : ''}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums">{formatEUR(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {contextMarkdown || problemSolutionPairs.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Contexto y solución</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {contextMarkdown ? (
                <section>
                  <h3 className="mb-1 text-sm font-medium">Contexto</h3>
                  <Markdown source={contextMarkdown} />
                </section>
              ) : null}
              {problemSolutionPairs.map((pair) => (
                <div
                  key={pair.id}
                  className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-2"
                >
                  {pair.problem || pair.problemDescription ? (
                    <section>
                      <h3 className="text-sm font-medium">
                        Problema{pair.problem ? ` · ${pair.problem}` : ''}
                      </h3>
                      {pair.problemDescription ? (
                        <Markdown source={pair.problemDescription} />
                      ) : null}
                    </section>
                  ) : null}
                  {pair.solution || pair.solutionDescription ? (
                    <section>
                      <h3 className="text-sm font-medium">
                        Solución{pair.solution ? ` · ${pair.solution}` : ''}
                      </h3>
                      {pair.solutionDescription ? (
                        <Markdown source={pair.solutionDescription} />
                      ) : null}
                    </section>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {scopeModules.length > 0 || deliverables || acceptanceCriteria || notes ? (
          <Card id="proposal-scope">
            <CardHeader>
              <CardTitle>Alcance</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {scopeModules.map((module) => (
                <div key={module.id} className="rounded-lg border border-border p-3">
                  <p className="font-medium">{module.title}</p>
                  {module.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                  ) : null}
                </div>
              ))}
              {deliverables ? <Markdown source={deliverables} /> : null}
              {acceptanceCriteria ? <Markdown source={acceptanceCriteria} /> : null}
              {notes ? <Markdown source={notes} /> : null}
            </CardContent>
          </Card>
        ) : null}

        {terms || changeManagementTerms || legalTerms ? (
          <Card>
            <CardHeader>
              <CardTitle>Condiciones de la propuesta</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {terms ? (
                <section>
                  <h3 className="mb-1 text-sm font-medium">Condiciones adicionales</h3>
                  <Markdown source={terms} />
                </section>
              ) : null}
              {changeManagementTerms ? (
                <section>
                  <h3 className="mb-1 text-sm font-medium">Gestión de cambios</h3>
                  <Markdown source={changeManagementTerms} />
                </section>
              ) : null}
              {legalTerms ? (
                <details className="rounded-lg border border-border bg-muted/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Anexo contractual
                  </summary>
                  <div className="mt-3">
                    <Markdown source={legalTerms} />
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {maintenanceOffer ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {maintenanceOffer.enabled ? maintenanceOffer.heading : 'Mantenimiento'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {maintenanceOffer.enabled ? (
                <>
                  <p className="text-sm text-muted-foreground">{maintenanceOffer.intro}</p>
                  <p className="text-xs text-muted-foreground">
                    Facturación {BILLING_CYCLE_LABELS[maintenanceOffer.billing_cycle]} · importes +
                    IVA
                  </p>
                  {maintenanceOffer.plans.map((plan) => {
                    const recommended = maintenanceOffer.recommended_plan_id === plan.id
                    const selected = maintenanceSelectedPlanId === plan.id
                    return (
                      <article key={plan.id} className="rounded-lg border border-border p-4">
                        <header className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{plan.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {recommended ? <Badge variant="info">Recomendado</Badge> : null}
                            {selected ? <Badge variant="success">Seleccionado</Badge> : null}
                            <span className="text-sm font-semibold tabular-nums">
                              {formatEUR(
                                recurringAmount(plan.monthly_price, maintenanceOffer.billing_cycle),
                              )}
                              {' / '}
                              {BILLING_CYCLE_LABELS[maintenanceOffer.billing_cycle]} + IVA
                            </span>
                          </div>
                        </header>
                        <details className="mt-3 rounded-md bg-muted/30 p-3">
                          <summary className="cursor-pointer text-sm font-medium">
                            Ver cobertura y exclusiones
                          </summary>
                          <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                            <section>
                              <h4 className="font-medium">Incluye</h4>
                              {plan.coverage.length > 0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                                  {plan.coverage.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-muted-foreground">
                                  Sin coberturas detalladas.
                                </p>
                              )}
                            </section>
                            <section>
                              <h4 className="font-medium">No incluye</h4>
                              {plan.exclusions.length > 0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                                  {plan.exclusions.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-muted-foreground">
                                  Sin exclusiones detalladas.
                                </p>
                              )}
                            </section>
                          </div>
                        </details>
                      </article>
                    )
                  })}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No se incluyó una oferta de mantenimiento en esta propuesta.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Adjuntos</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {attachments.length > 0 ? (
              <ul className="divide-y divide-border">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center gap-3 px-6 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{attachment.name}</p>
                      {formatAttachmentSize(attachment.size_bytes) ? (
                        <p className="text-xs text-muted-foreground">
                          {formatAttachmentSize(attachment.size_bytes)}
                        </p>
                      ) : null}
                    </div>
                    {attachment.source === 'drive' && attachment.web_view_link ? (
                      <Link
                        href={attachment.web_view_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Abrir en Drive"
                      >
                        <ExternalLink className="size-4" aria-hidden />
                        <span className="sr-only">Abrir en Drive</span>
                      </Link>
                    ) : (
                      <>
                        {attachment.mime_type === 'application/pdf' ? (
                          <Link
                            href={`/api/documents/${attachment.id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Ver PDF"
                          >
                            <Eye className="size-4" aria-hidden />
                            <span className="sr-only">Ver PDF</span>
                          </Link>
                        ) : null}
                        <Link
                          href={`/api/documents/${attachment.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Descargar"
                        >
                          <Download className="size-4" aria-hidden />
                          <span className="sr-only">Descargar</span>
                        </Link>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin adjuntos.</p>
            )}
          </CardContent>
        </Card>
        {mainContent}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        {sidebarTop}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Equipo del proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            {team.length > 0 ? (
              <ul className="flex flex-col gap-3 text-sm">
                {team.map((member) => (
                  <li key={member.id}>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-muted-foreground">
                      {member.job_title ?? 'Equipo Doscientos'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay personas asignadas.</p>
            )}
          </CardContent>
        </Card>
        {sidebar}
      </div>
    </div>
  )
}
