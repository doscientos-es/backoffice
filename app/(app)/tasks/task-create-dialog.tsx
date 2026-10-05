'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@doscientos/ui'
import { Plus } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import type { TaskPriorityType, TaskStatusType } from '@/lib/schemas/task'

import { createTask } from './actions'
import { getDefaultTaskDueDate, TaskFormFields } from './task-form-fields'

interface Props {
  /** Pre-fills `project_id`. Renders as a hidden input so parent stays fixed. */
  projectId?: string
  /** Pre-fills `lead_id`. Renders as a hidden input so parent stays fixed. */
  leadId?: string
  /** Pre-fills `client_id`. Renders as a hidden input so context stays fixed. */
  clientId?: string
  projects?: Array<{ id: string; name: string }>
  leads?: Array<{ id: string; name: string }>
  clients?: Array<{ id: string; name: string }>
  members?: Array<{ id: string; name: string }>
  /** Pre-selects the assignee. Defaults to the current user when provided. */
  currentUserId?: string
  /** Custom trigger. Falls back to a primary button labelled "Nueva tarea". */
  trigger?: ReactNode
  /** Controlled visibility, for flows that open the dialog after another action. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Optional callback fired after a successful creation (e.g. router refresh). */
  onCreated?: (id: string) => void
}

/**
 * In-context task creation dialog. Mirrors `TaskEditDialog` but invokes
 * `createTask` and reuses the same `TaskFormFields` block. The form is reset
 * after each successful submission so the dialog can be reused without
 * remounting.
 */
export function TaskCreateDialog({
  projectId,
  leadId,
  clientId,
  projects = [],
  leads = [],
  clients = [],
  members = [],
  currentUserId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onCreated,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const feedback = useFormFeedback()
  const formRef = useRef<HTMLFormElement>(null)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  function setOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const fd = new FormData(e.currentTarget)
    const res = await createTask({
      title: fd.get('title')?.toString() ?? '',
      description: fd.get('description')?.toString() ?? '',
      client_title: fd.get('client_title')?.toString() ?? '',
      client_summary: fd.get('client_summary')?.toString() ?? '',
      project_id: projectId ?? fd.get('project_id')?.toString() ?? '',
      lead_id: leadId ?? fd.get('lead_id')?.toString() ?? '',
      client_id: clientId ?? fd.get('client_id')?.toString() ?? '',
      member_ids: fd
        .getAll('member_ids')
        .map((v) => v.toString())
        .filter(Boolean),
      status: (fd.get('status')?.toString() ?? 'todo') as TaskStatusType,
      priority: (fd.get('priority')?.toString() ?? 'medium') as TaskPriorityType,
      due_date: fd.get('due_date')?.toString() ?? '',
      is_client_visible: fd.get('is_client_visible') === 'on',
    })
    if (!res.ok) return feedback.setError(res.error)
    feedback.setSuccess('Tarea creada')
    formRef.current?.reset()
    onCreated?.(res.id)
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) feedback.reset()
      }}
    >
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" aria-hidden />
            Nueva tarea
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="w-[calc(100vw-1rem)] max-w-none p-4 sm:w-auto sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Crear tarea</DialogTitle>
          <DialogDescription>
            Puedes crear una tarea personal y asociarla opcionalmente a un proyecto, lead o cliente.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="flex max-h-[calc(100dvh-8rem)] flex-col sm:max-h-[70vh]"
        >
          <div className="no-scrollbar flex min-h-0 flex-1 scroll-fade flex-col gap-5 overflow-y-auto pr-1">
            {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
            {leadId ? <input type="hidden" name="lead_id" value={leadId} /> : null}
            {clientId ? <input type="hidden" name="client_id" value={clientId} /> : null}
            <TaskFormFields
              idPrefix="create"
              autoFocusTitle
              includeParentSelectors={!projectId && !leadId && !clientId}
              projects={projects}
              leads={leads}
              clients={clients}
              members={members}
              defaults={{
                status: 'todo',
                priority: 'medium',
                due_date: getDefaultTaskDueDate(),
                member_ids: currentUserId ? [currentUserId] : [],
                project_id: projectId,
              }}
            />
          </div>
          <div className="-mx-4 flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:bg-transparent sm:p-0 sm:pt-3 sm:backdrop-blur-none">
            <FormFeedback state={feedback.state} pendingLabel="Creando…" />
            <SubmitButton
              className="min-h-11 w-full sm:w-auto"
              loading={feedback.pending}
              pendingLabel="Creando…"
            >
              Crear tarea
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
