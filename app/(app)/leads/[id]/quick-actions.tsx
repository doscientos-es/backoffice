'use client'

import { CalendarDays as CalendarClock, ChevronDown, Hand, ListTodo } from 'lucide-react'
import { type ReactNode, useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@doscientos/ui'

import {
  type ScheduleMember,
  ScheduleReminderDialog,
} from '../../reminders/schedule-reminder-dialog'
import { claimLead } from '../actions'
import {
  type MeetMember,
  QCallDialog,
  QEmailDialog,
  QMeetDialog,
  QMeetNowDialog,
  QNoteDialog,
  QSendEmailDialog,
  QWhatsAppDialog,
  QuickActionTile,
} from '../lead-quick-action-dialogs'
import { ExtractTasksDialog, type ExtractTasksDialogProps } from './extract-tasks-dialog'
import { GmailSyncButton } from './gmail-sync-button'

type Props = {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  senderName: string
  openCallInitially?: boolean
  openScheduleInitially?: boolean
  defaultDurationMinutes?: number | null
  claimable?: boolean
  aiEnabled?: boolean
  googleEnabled?: boolean
  projects?: Array<{ id: string; name: string }>
  meetMembers?: MeetMember[]
  /** Team members for the "Agendar" assignee picker. */
  scheduleMembers?: ScheduleMember[]
  createTaskAction?: ExtractTasksDialogProps['createTaskAction']
}

export function LeadQuickActions({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  senderName,
  openCallInitially,
  openScheduleInitially,
  defaultDurationMinutes,
  claimable,
  aiEnabled,
  googleEnabled,
  projects = [],
  meetMembers = [],
  scheduleMembers = [],
  createTaskAction,
}: Props) {
  const canExtractTasks = aiEnabled && createTaskAction
  const secondaryActionCount = 2 + (googleEnabled ? 3 : 0) + (canExtractTasks ? 1 : 0)

  return (
    <div className="flex flex-col gap-3">
      {claimable && <ClaimButton leadId={leadId} />}

      {/* Primary: 2x2 tactile tiles, one per channel */}
      <div className="grid grid-cols-2 gap-2">
        <QCallDialog
          leadId={leadId}
          leadPhone={leadPhone}
          leadName={leadName}
          leadEmail={leadEmail}
          senderName={senderName}
          aiEnabled={aiEnabled}
          openInitially={openCallInitially}
          defaultDurationMinutes={defaultDurationMinutes}
        />
        <QWhatsAppDialog
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail}
          leadPhone={leadPhone}
          senderName={senderName}
          aiEnabled={aiEnabled}
        />
        <QSendEmailDialog leadId={leadId} leadEmail={leadEmail} aiEnabled={aiEnabled} />
        <ScheduleDialog
          leadId={leadId}
          leadName={leadName}
          members={scheduleMembers}
          openInitially={openScheduleInitially}
        />
      </div>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground group/more flex w-full items-center justify-center gap-1.5 rounded-md py-0.5 text-xs font-medium transition-colors"
          >
            Más acciones
            <span className="bg-muted rounded-full px-1.5 py-0.5 text-[10px] tabular-nums">
              {secondaryActionCount}
            </span>
            <ChevronDown className="size-3 transition-transform group-aria-expanded/more:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2.5">
          <div className="bg-muted/30 flex flex-col gap-2.5 rounded-lg p-2.5">
            <ActionGroup label="Registrar">
              <QEmailDialog leadId={leadId} leadEmail={leadEmail} />
              <QNoteDialog leadId={leadId} />
            </ActionGroup>
            {googleEnabled && (
              <>
                <ActionGroup label="Reuniones">
                  <QMeetNowDialog
                    leadId={leadId}
                    leadName={leadName}
                    leadEmail={leadEmail}
                    meetMembers={meetMembers}
                  />
                  <QMeetDialog
                    leadId={leadId}
                    leadName={leadName}
                    leadEmail={leadEmail}
                    projects={projects}
                    meetMembers={meetMembers}
                  />
                </ActionGroup>
                <ActionGroup label="Herramientas">
                  <GmailSyncButton leadId={leadId} leadEmail={leadEmail} />
                  {canExtractTasks && (
                    <ExtractTasksDialog
                      leadId={leadId}
                      createTaskAction={createTaskAction}
                      trigger={
                        <ActionTrigger
                          icon={<ListTodo className="size-4" />}
                          label="Extraer tareas IA"
                        />
                      }
                    />
                  )}
                </ActionGroup>
              </>
            )}
            {!googleEnabled && canExtractTasks && (
              <ActionGroup label="Herramientas">
                <ExtractTasksDialog
                  leadId={leadId}
                  createTaskAction={createTaskAction}
                  trigger={
                    <ActionTrigger
                      icon={<ListTodo className="size-4" />}
                      label="Extraer tareas IA"
                    />
                  }
                />
              </ActionGroup>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function ActionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  )
}

function ClaimButton({ leadId }: { leadId: string }) {
  const [claimed, setClaimed] = useState(false)
  const [, startTransition] = useTransition()

  if (claimed) return null

  const onClick = () => {
    setClaimed(true) // optimistic: hide button immediately
    startTransition(async () => {
      const res = await claimLead({ leadId })
      if (!res.ok) {
        setClaimed(false) // revert
        sileo.error({ title: res.error })
      }
    })
  }

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      className="w-full justify-start gap-2"
      onClick={onClick}
    >
      <span className="text-primary-foreground/70">
        <Hand className="size-4" />
      </span>
      <span className="text-sm font-medium">Asignármelo</span>
    </Button>
  )
}

function ActionTrigger({
  icon,
  label,
  ...rest
}: { icon: ReactNode; label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-auto min-w-0 justify-start gap-2 px-2.5 py-2"
      {...rest}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="truncate text-xs leading-tight font-medium">{label}</span>
    </Button>
  )
}

// ---------------- SCHEDULE (reminder) ----------------

function ScheduleDialog({
  leadId,
  leadName,
  members,
  openInitially = false,
}: {
  leadId: string
  leadName: string
  members?: ScheduleMember[]
  openInitially?: boolean
}) {
  const [open, setOpen] = useState(openInitially)

  return (
    <ScheduleReminderDialog
      leadId={leadId}
      defaultTitle={`Llamar a ${leadName}`}
      defaultActionType="call"
      members={members}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <QuickActionTile
          icon={<CalendarClock className="text-muted-foreground size-3.5" />}
          label="Agendar llamada"
        />
      }
    />
  )
}
