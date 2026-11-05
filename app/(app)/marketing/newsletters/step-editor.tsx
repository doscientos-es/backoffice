import { SubmitButton } from '@doscientos/ui'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EmailMarketingStep } from '@/lib/marketing/email-marketing'

import { ActionForm, DeleteStepDialog } from './action-form'
import { updateEmailMarketingStep } from './actions'
import { MessageFields } from './message-fields'

function dateTimeLocalValue(value: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

export function StepEditor({ step, canDelete }: { step: EmailMarketingStep; canDelete: boolean }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-medium">Editar o eliminar este email</summary>
      <ActionForm
        action={updateEmailMarketingStep}
        success="Email actualizado"
        className="mt-3 grid gap-3 rounded-lg border bg-background p-4"
      >
        <input type="hidden" name="id" value={step.id} />
        <div className="grid gap-1.5">
          <Label htmlFor={`edit-title-${step.id}`}>Nombre interno</Label>
          <Input
            id={`edit-title-${step.id}`}
            name="title"
            required
            minLength={2}
            maxLength={140}
            defaultValue={step.title}
          />
        </div>
        <MessageFields
          id={`edit-${step.id}`}
          initial={{
            subject: step.subject,
            previewText: step.preview_text ?? '',
            bodyMarkdown: step.body_markdown,
          }}
        />
        <div className="grid gap-1.5">
          <Label htmlFor={`edit-date-${step.id}`}>Fecha y hora de envío · horario peninsular</Label>
          <Input
            id={`edit-date-${step.id}`}
            name="scheduledAt"
            type="datetime-local"
            required
            defaultValue={dateTimeLocalValue(step.scheduled_at)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton variant="outline" loadingLabel="Guardando…">
            Guardar cambios
          </SubmitButton>
          {canDelete ? (
            <DeleteStepDialog id={step.id} title={step.title} />
          ) : (
            <span className="self-center text-xs text-muted-foreground">
              Solo un administrador puede eliminar emails.
            </span>
          )}
        </div>
      </ActionForm>
    </details>
  )
}
