'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'

import { LineItemsTable } from '@/components/finance/line-items-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { EntityCombobox } from '@/components/ui/entity-combobox'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EMPTY_LINE_ITEM, type LineItem } from '@/lib/finance'
import { formatProposalValidationIssues } from '@/lib/proposals/validation'
import { CreateProposalInput } from '@/lib/schemas/proposal'

import { createProposalAction } from '../actions'

type Props = {
  clients: Array<{ id: string; name: string }>
  leads: Array<{ id: string; name: string; company: string | null; status: string }>
  projects: Array<{ id: string; name: string; client_id: string }>
  initialClientId?: string
  initialLeadId?: string
  aiEnabled: boolean
}

type Recipient = { kind: 'client'; id: string } | { kind: 'lead'; id: string } | null

/**
 * Explicit create flow for proposals. The detail page (`/proposals/[id]`)
 * owns the draft editor; here the user fills a draft
 * and confirms with a single click — on success we navigate to the detail
 * view where further edits are saved explicitly.
 *
 * The recipient is either an existing client or an open lead. An existing
 * client project can optionally be linked.
 */
export function NewProposalForm({
  clients,
  leads,
  projects,
  initialClientId,
  initialLeadId,
  aiEnabled,
}: Props) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 4000 })
  const [pending, startTransition] = useTransition()
  const creating = useRef(false)
  const [itemsOpen, setItemsOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [recovery, setRecovery] = useState<string | null>(null)

  const [recipient, setRecipient] = useState<Recipient>(() => {
    if (initialClientId && clients.some((client) => client.id === initialClientId))
      return { kind: 'client', id: initialClientId }
    if (initialLeadId && leads.some((lead) => lead.id === initialLeadId))
      return { kind: 'lead', id: initialLeadId }
    return null
  })
  const recipientValue = recipient ? `${recipient.kind}:${recipient.id}` : ''
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [invalidDate, setInvalidDate] = useState(false)
  const [notes, setNotes] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [projectId, setProjectId] = useState('')

  // Projects available for the selected client
  const clientProjects = useMemo(
    () =>
      recipient?.kind === 'client' ? projects.filter((p) => p.client_id === recipient.id) : [],
    [projects, recipient],
  )
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM, id: crypto.randomUUID() }])

  const selectedRecipient = useMemo(() => {
    if (!recipient) return null
    return recipient.kind === 'lead'
      ? (leads.find((lead) => lead.id === recipient.id) ?? null)
      : (clients.find((client) => client.id === recipient.id) ?? null)
  }, [clients, leads, recipient])

  function handleCreate(mode: 'blank' | 'ai') {
    if (creating.current || pending || recovery) return
    if (!recipient || !selectedRecipient) {
      feedback.setError('Selecciona el destinatario de la propuesta')
      document.getElementById('recipient')?.focus()
      return
    }
    if (mode === 'ai' && recipient.kind !== 'lead') {
      feedback.setError('El prerrelleno con IA necesita una propuesta vinculada a un lead')
      return
    }
    if (invalidDate) {
      feedback.setError('Fecha de validez: introduce una fecha válida o deja el campo vacío.')
      document.getElementById('valid_until')?.focus()
      return
    }

    const firstItem = items[0]
    const onlyUntouchedPlaceholder =
      items.length === 1 &&
      firstItem &&
      firstItem.description.trim() === '' &&
      firstItem.quantity === EMPTY_LINE_ITEM.quantity &&
      firstItem.unit_price === EMPTY_LINE_ITEM.unit_price &&
      firstItem.vat_rate === EMPTY_LINE_ITEM.vat_rate &&
      (firstItem.billing_cycle ?? 'none') === 'none' &&
      (firstItem.discount_percent ?? 0) === 0 &&
      !firstItem.discount_reason?.trim()
    const proposalItems = onlyUntouchedPlaceholder
      ? [{ ...firstItem, description: 'Pendiente de definir' }]
      : items.map((item) => ({ ...item, description: item.description.trim() }))
    const input = {
      client_id: recipient.kind === 'client' ? recipient.id : undefined,
      lead_id: recipient.kind === 'lead' ? recipient.id : undefined,
      project_id: projectId || undefined,
      title: title.trim() || `Propuesta para ${selectedRecipient.name}`.slice(0, 200),
      valid_until: validUntil || undefined,
      notes: notes || undefined,
      demo_url: demoUrl || undefined,
      items: proposalItems,
    }
    const parsed = CreateProposalInput.safeParse(input)
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.path[0] === 'items')) setItemsOpen(true)
      if (parsed.error.issues.some((issue) => issue.path[0] === 'demo_url')) setOptionsOpen(true)
      feedback.setError(formatProposalValidationIssues(parsed.error.issues).join('\n'))
      return
    }

    creating.current = true
    feedback.setPending()
    startTransition(async () => {
      try {
        const res = await createProposalAction(parsed.data)
        if (!res.ok) {
          creating.current = false
          if (res.id) setRecovery(`/proposals/${res.id}?mode=edit`)
          feedback.setError(res.error)
          return
        }
        feedback.setSuccess('Propuesta creada')
        router.push(`/proposals/${res.id}${mode === 'ai' ? '?ai_draft=1' : '?mode=edit'}`)
      } catch {
        setRecovery('/proposals')
        feedback.setError(
          'No se pudo confirmar la creación. Revisa el listado antes de volver a intentarlo para evitar duplicados.',
        )
      }
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleCreate('blank')
  }

  function onRecipientChange(value: string) {
    setProjectId('') // reset project when recipient changes
    if (!value) {
      setRecipient(null)
      return
    }
    const [kind, id] = value.split(':', 2)
    if ((kind === 'client' || kind === 'lead') && id) {
      setRecipient({ kind, id })
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto flex w-full max-w-6xl flex-col gap-5"
    >
      <section aria-labelledby="proposal-details-heading">
        <Card className="border-border shadow-none">
          <CardContent className="pt-6">
            <header className="mb-5">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                01 · Base comercial
              </p>
              <h2 id="proposal-details-heading" className="mt-1 text-base font-semibold">
                Destinatario y contexto
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Elige un destinatario y crea un borrador. Podrás completar y revisar todo antes de
                enviarlo.
              </p>
            </header>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormRow
                label="Destinatario"
                htmlFor="recipient"
                required
                hint="Cliente existente o lead. Si es lead, le pediremos sus datos fiscales al aceptar."
              >
                <EntityCombobox
                  id="recipient"
                  items={[
                    ...clients.map((c) => ({ id: `client:${c.id}`, label: c.name })),
                    ...leads.map((l) => ({
                      id: `lead:${l.id}`,
                      label: l.name,
                      sublabel: l.company,
                    })),
                  ]}
                  value={recipientValue}
                  onChange={onRecipientChange}
                  placeholder="Buscar cliente o lead…"
                />
              </FormRow>
              <FormRow
                label="Título"
                htmlFor="title"
                hint="Opcional. Si lo dejas vacío, usaremos el nombre del destinatario."
              >
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder={
                    selectedRecipient
                      ? `Propuesta para ${selectedRecipient.name}`
                      : 'Se generará automáticamente'
                  }
                />
              </FormRow>
              <FormRow
                label="Válida hasta"
                htmlFor="valid_until"
                hint="Fecha límite de aceptación."
              >
                <DateField
                  id="valid_until"
                  value={validUntil}
                  onChange={setValidUntil}
                  onInvalidChange={setInvalidDate}
                  aria-invalid={invalidDate}
                />
              </FormRow>
              {clientProjects.length > 0 && (
                <FormRow
                  label="Proyecto"
                  htmlFor="project_id"
                  hint="Opcional. Vincula esta propuesta a un proyecto existente."
                >
                  <EntityCombobox
                    id="project_id"
                    items={clientProjects.map((p) => ({ id: p.id, label: p.name }))}
                    value={projectId}
                    onChange={setProjectId}
                    placeholder="Buscar proyecto…"
                  />
                </FormRow>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <details
        open={itemsOpen}
        onToggle={(event) => setItemsOpen(event.currentTarget.open)}
        className="rounded-xl border border-border bg-card"
      >
        <summary className="cursor-pointer px-6 py-5 text-sm font-semibold">
          Añadir partidas iniciales{' '}
          <span className="font-normal text-muted-foreground">· opcional</span>
        </summary>
        <section aria-labelledby="proposal-items-heading" className="px-6 pb-6">
          <header className="mb-4">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              02 · Inversión
            </p>
            <h2 id="proposal-items-heading" className="mt-1 text-base font-semibold">
              Partidas iniciales
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Añade los servicios ya definidos. Si no añades ninguno, se creará una partida
              pendiente de definir.
            </p>
          </header>
          <div className="min-w-0 overflow-hidden rounded-lg border border-border">
            <LineItemsTable items={items} onChange={setItems} showBillingCycle />
          </div>
        </section>
      </details>

      <details
        open={optionsOpen}
        onToggle={(event) => setOptionsOpen(event.currentTarget.open)}
        className="rounded-xl border border-border bg-card"
      >
        <summary className="cursor-pointer px-6 py-5 text-sm font-semibold">
          Más detalles <span className="font-normal text-muted-foreground">· opcional</span>
        </summary>
        <section aria-labelledby="proposal-notes-heading" className="space-y-5 px-6 pb-6">
          <header className="mb-4">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              03 · Aclaraciones
            </p>
            <h2 id="proposal-notes-heading" className="mt-1 text-base font-semibold">
              Información adicional
            </h2>
          </header>
          <FormRow
            label="Enlace de la demo"
            htmlFor="demo_url"
            hint="Se mostrará al cliente en la propuesta pública."
          >
            <Input
              id="demo_url"
              type="url"
              maxLength={2048}
              placeholder="https://ejemplo.com/demo"
              value={demoUrl}
              onChange={(event) => setDemoUrl(event.target.value)}
            />
          </FormRow>
          <FormRow
            label="Notas"
            htmlFor="notes"
            hint="Condiciones generales, alcance o aclaraciones para el cliente."
          >
            <Textarea
              id="notes"
              rows={4}
              maxLength={4000}
              placeholder="Condiciones, alcance, observaciones…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormRow>
        </section>
      </details>

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
        <div className="max-h-40 min-w-0 overflow-y-auto whitespace-pre-line">
          <FormFeedback
            className="h-auto min-h-5 items-start"
            state={feedback.state}
            pendingLabel="Creando…"
          />
          {recovery ? (
            <Link className="mt-2 block text-sm font-medium underline" href={recovery}>
              {recovery === '/proposals' ? 'Revisar propuestas' : 'Abrir borrador creado'}
            </Link>
          ) : null}
        </div>
        <div className="ml-auto flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          <Button asChild variant="ghost" size="sm">
            <Link href="/proposals">Cancelar</Link>
          </Button>
          {aiEnabled ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                pending ||
                feedback.state.status === 'success' ||
                Boolean(recovery) ||
                recipient?.kind !== 'lead'
              }
              onClick={() => handleCreate('ai')}
              title={
                recipient?.kind !== 'lead'
                  ? 'Selecciona un lead para usar su contexto con IA'
                  : undefined
              }
            >
              {pending ? 'Creando…' : 'Crear y prerrellenar con IA'}
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={pending || feedback.state.status === 'success' || Boolean(recovery)}
          >
            {pending ? 'Creando…' : 'Crear borrador'}
          </Button>
        </div>
      </div>
      {aiEnabled ? (
        <p className="-mt-3 text-right text-xs text-muted-foreground">
          La IA usa ficha, notas, interacciones y llamadas del lead. No propone importes ni
          condiciones que no consten en el CRM.
        </p>
      ) : null}
    </form>
  )
}
