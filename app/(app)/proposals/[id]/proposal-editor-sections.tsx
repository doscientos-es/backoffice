import { Sparkle as Sparkles } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

import { LineItemsTable } from '@/components/finance/line-items-table'
import { MaintenanceOfferEditor } from '@/components/proposals/maintenance-offer-editor'
import { PaymentPlanEditor } from '@/components/proposals/payment-plan-editor'
import { ProblemSolutionEditor } from '@/components/proposals/problem-solution-editor'
import { ScopeModulesEditor } from '@/components/proposals/scope-modules-editor'
import { AiNotice } from '@/components/ui/ai-notice'
import { AttachmentSection } from '@/components/ui/attachment-section'
import { Button } from '@/components/ui/button'
import { FormFeedback, type useFormFeedback } from '@/components/ui/form-feedback'
import { FormRow } from '@/components/ui/form-row'
import { Input } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { computeProposalTotals, LineItem } from '@/lib/finance'
import type { selectedMaintenancePlan } from '@/lib/proposals/maintenance'
import { PAYMENT_SCHEDULE_LABELS, type PaymentSchedule } from '@/lib/proposals/scope'
import { formatEUR } from '@/lib/utils'

import type { ProposalDraft } from './proposal-draft'
import type { ProposalEditorProps } from './proposal-editor-types'
import type { useProposalDraft } from './use-proposal-draft'
type SectionProps = {
  draft: ProposalDraft
  setField: ReturnType<typeof useProposalDraft>['setField']
  locked: boolean
}

export function ProposalDetailsSection({
  draft,
  setField,
  locked,
  id,
  initialAttachments,
  aiEnabled,
  leadId,
  hasEmptyDraftFields,
  generating,
  handleGenerateDraft,
  notesPreview,
  setNotesPreview,
}: SectionProps & {
  id: string
  initialAttachments: ProposalEditorProps['initialAttachments']
  aiEnabled: boolean
  leadId: string | null
  hasEmptyDraftFields: boolean
  generating: boolean
  handleGenerateDraft: () => Promise<void>
  notesPreview: boolean
  setNotesPreview: Dispatch<SetStateAction<boolean>>
}) {
  const { title, validUntil, notes } = draft
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <header>
        <h2 className="text-base font-semibold">Empieza por lo esencial</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define la vigencia y añade solo las notas que necesites para preparar la propuesta.
        </p>
      </header>

      <FormRow label="Título" htmlFor="proposal-title">
        <Input
          id="proposal-title"
          value={title}
          onChange={(event) => setField('title')(event.target.value)}
          disabled={locked}
          placeholder="Título de la propuesta"
          aria-label="Título"
        />
      </FormRow>

      {aiEnabled && leadId && hasEmptyDraftFields && !locked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium">Prepara una primera versión con IA</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Usa el historial del lead y rellena solo los campos que estén vacíos.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={generating}
            onClick={() => void handleGenerateDraft()}
          >
            <Sparkles className="size-4" aria-hidden />
            {generating ? 'Preparando…' : 'Crear borrador'}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)]">
        <FormRow
          label="Válida hasta"
          htmlFor="valid-until"
          hint="Fecha límite para aceptar esta propuesta."
        >
          <Input
            id="valid-until"
            type="date"
            value={validUntil}
            onChange={(event) => setField('validUntil')(event.target.value)}
            disabled={locked}
          />
        </FormRow>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Notas</span>
            {notes ? (
              <button
                type="button"
                onClick={() => setNotesPreview((preview) => !preview)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {notesPreview ? 'Editar' : 'Previsualizar'}
              </button>
            ) : null}
          </div>
          {notesPreview && notes ? (
            <div className="min-h-32 rounded-md border border-border bg-muted/20 px-3 py-2">
              <Markdown source={notes} />
            </div>
          ) : (
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setField('notes')(event.target.value)}
              disabled={locked}
              rows={5}
              placeholder="Notas internas o para el cliente… (soporta Markdown)"
            />
          )}
        </div>
      </div>

      <AttachmentSection
        entityType="proposal"
        entityId={id}
        attachments={initialAttachments}
        canEdit={!locked}
      />
    </section>
  )
}

export function ProposalScopeSection({
  draft,
  setField,
  locked,
  aiFeedback,
  aiEnabled,
  generating,
  handleGenerateNarrative,
}: SectionProps & {
  aiFeedback: ReturnType<typeof useFormFeedback>
  aiEnabled: boolean
  generating: boolean
  handleGenerateNarrative: () => Promise<void>
}) {
  const { contextMarkdown, pairs, scopeModules, deliverables, acceptanceCriteria } = draft
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Cuenta la propuesta</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Explica el punto de partida y cómo lo vas a resolver.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <FormFeedback state={aiFeedback.state} pendingLabel="Generando…" />
            {!aiEnabled ? <AiNotice inline /> : null}
          </div>
        </header>
        <FormRow
          label="Contexto"
          htmlFor="context-markdown"
          hint="Resume la situación actual del cliente en 2-3 frases."
        >
          <Textarea
            id="context-markdown"
            value={contextMarkdown}
            onChange={(event) => setField('contextMarkdown')(event.target.value)}
            disabled={locked}
            rows={4}
            placeholder="Tras nuestras conversaciones, hemos detectado que…"
          />
        </FormRow>
        <FormRow
          label="Problemas y soluciones"
          htmlFor="problems-solutions"
          hint="Cada problema se mostrará junto a su solución."
        >
          <ProblemSolutionEditor
            items={pairs}
            onChange={setField('pairs')}
            locked={locked}
            aiEnabled={aiEnabled}
            onGenerate={() => void handleGenerateNarrative()}
            generating={generating}
          />
        </FormRow>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <header>
          <h2 className="text-base font-semibold">Alcance y entregables</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Añade los módulos y concreta lo que recibirá el cliente.
          </p>
        </header>
        <ScopeModulesEditor
          modules={scopeModules}
          onChange={setField('scopeModules')}
          locked={locked}
        />
        <FormRow
          label="Entregables"
          htmlFor="deliverables"
          hint="Qué recibirá el cliente al finalizar."
        >
          <Textarea
            id="deliverables"
            value={deliverables}
            onChange={(event) => setField('deliverables')(event.target.value)}
            disabled={locked}
            rows={4}
            placeholder="- Diseño validado\n- Desarrollo de los módulos acordados\n- Formación y documentación"
          />
        </FormRow>
        <details className="rounded-lg border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Añadir criterios de aceptación
          </summary>
          <div className="mt-3">
            <FormRow
              label="Criterios de aceptación"
              htmlFor="acceptance-criteria"
              hint="Cómo comprobaremos que el trabajo está entregado."
            >
              <Textarea
                id="acceptance-criteria"
                value={acceptanceCriteria}
                onChange={(event) => setField('acceptanceCriteria')(event.target.value)}
                disabled={locked}
                rows={4}
                placeholder="- Los flujos descritos funcionan en producción.\n- El cliente valida los entregables acordados."
              />
            </FormRow>
          </div>
        </details>
      </section>
    </div>
  )
}

export function ProposalPriceSection({
  draft,
  setField,
  locked,
  proposalTotals,
  handleItemsChange,
  handlePaymentScheduleChange,
}: SectionProps & {
  proposalTotals: ReturnType<typeof computeProposalTotals>
  handleItemsChange: (items: LineItem[]) => void
  handlePaymentScheduleChange: (schedule: PaymentSchedule) => void
}) {
  const {
    terms,
    paymentSchedule,
    paymentPlan,
    paymentTerms,
    changeManagementTerms,
    legalTerms,
    items,
  } = draft
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <header>
          <h2 className="text-base font-semibold">Precio de la propuesta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Añade una partida por cada servicio. Los totales se calculan automáticamente.
          </p>
        </header>
        <div className="min-w-0 overflow-hidden rounded-lg border border-border">
          <LineItemsTable
            items={items}
            onChange={handleItemsChange}
            locked={locked}
            showBillingCycle
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <header>
          <h2 className="text-base font-semibold">Forma de pago</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige una base y ajusta el mensaje para el cliente si lo necesitas.
          </p>
        </header>
        <FormRow label="Calendario de pago" htmlFor="payment-schedule">
          <div className="flex flex-col gap-3">
            <Select
              id="payment-schedule"
              value={paymentSchedule}
              onChange={(event) =>
                handlePaymentScheduleChange(event.target.value as PaymentSchedule)
              }
              disabled={locked}
            >
              {Object.entries(PAYMENT_SCHEDULE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Textarea
              value={paymentTerms}
              onChange={(event) => {
                setField('paymentTermsCustomized')(true)
                setField('paymentTerms')(event.target.value)
              }}
              disabled={locked}
              rows={4}
              placeholder="Condiciones de pago"
              aria-label="Condiciones de pago"
            />
          </div>
        </FormRow>
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="mb-1 text-sm font-medium">Facturación por plazos</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Personaliza los cobros que se prepararán como borradores al aceptar la propuesta.
          </p>
          <PaymentPlanEditor
            plan={paymentPlan}
            total={proposalTotals.oneTime.total}
            onChange={setField('paymentPlan')}
            locked={locked}
          />
        </div>
        <details className="rounded-lg border border-border bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium">Personalizar condiciones</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <FormRow label="Gestión de cambios" htmlFor="change-management">
              <Textarea
                id="change-management"
                value={changeManagementTerms}
                onChange={(event) => setField('changeManagementTerms')(event.target.value)}
                disabled={locked}
                rows={5}
              />
            </FormRow>
            <FormRow label="Condiciones adicionales" htmlFor="terms">
              <Textarea
                id="terms"
                value={terms}
                onChange={(event) => setField('terms')(event.target.value)}
                disabled={locked}
                rows={5}
                placeholder="Vigencia, licencias, garantías u otras condiciones."
              />
            </FormRow>
          </div>
          <FormRow
            label="Anexo contractual"
            htmlFor="legal-terms"
            hint="Se prellena al crear la propuesta, se acepta al firmar y se añade al final del PDF."
            className="mt-4"
          >
            <Textarea
              id="legal-terms"
              value={legalTerms}
              onChange={(event) => setField('legalTerms')(event.target.value)}
              disabled={locked}
              rows={16}
            />
          </FormRow>
        </details>
      </section>
    </div>
  )
}

export function ProposalReviewSection({
  draft,
  setField,
  locked,
  teamMembers,
  proposalTotals,
  selectedMaintenance,
}: SectionProps & {
  teamMembers: ProposalEditorProps['teamMembers']
  proposalTotals: ReturnType<typeof computeProposalTotals>
  selectedMaintenance: ReturnType<typeof selectedMaintenancePlan>
}) {
  const { maintenanceOptions, maintenanceSelectedPlanId, teamMemberIds } = draft
  return (
    <div className="flex flex-col gap-5">
      <MaintenanceOfferEditor
        offer={maintenanceOptions}
        selectedPlanId={maintenanceSelectedPlanId}
        onChange={setField('maintenanceOptions')}
        onSelectedPlanChange={setField('maintenanceSelectedPlanId')}
        locked={locked}
      />
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Equipo que verá el cliente</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecciona quién aparecerá junto a la propuesta y en el portal del cliente.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {teamMembers.map((member) => (
            <label
              key={member.id}
              aria-label={member.name}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3"
            >
              <input
                type="checkbox"
                checked={teamMemberIds.includes(member.id)}
                disabled={locked}
                onChange={(event) =>
                  setField('teamMemberIds')(
                    event.target.checked
                      ? [...teamMemberIds, member.id]
                      : teamMemberIds.filter((memberId) => memberId !== member.id),
                  )
                }
              />
              <span>
                <span className="block text-sm font-medium">{member.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {member.job_title ?? 'Equipo Doscientos'}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-background p-3">
            <p className="text-xs text-muted-foreground">Inversión inicial</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatEUR(proposalTotals.oneTime.total)}
            </p>
          </div>
          {maintenanceOptions.enabled ? (
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs text-muted-foreground">Mantenimiento</p>
              <p className="mt-1 text-lg font-semibold">
                {selectedMaintenance
                  ? `${selectedMaintenance.name} · ${formatEUR(selectedMaintenance.monthly_price)} / ${maintenanceOptions.billing_cycle === 'monthly' ? 'mes' : maintenanceOptions.billing_cycle === 'quarterly' ? 'trimestre' : 'año'}`
                  : 'Pendiente de elegir'}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
