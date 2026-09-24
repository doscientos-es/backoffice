'use client'

import { CalendarDays, ListTodo } from 'lucide-react'
import { useState } from 'react'

import { ScheduleReminderDialog, type ScheduleMember } from '../reminders/schedule-reminder-dialog'
import { ExtractTasksDialog, type ExtractTasksDialogProps } from './[id]/extract-tasks-dialog'
import { GmailSyncButton } from './[id]/gmail-sync-button'
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
} from './lead-quick-action-dialogs'

type Props = {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  senderName: string
  aiEnabled?: boolean
  googleEnabled?: boolean
  projects?: Array<{ id: string; name: string }>
  meetMembers?: MeetMember[]
  scheduleMembers?: ScheduleMember[]
  openCallInitially?: boolean
  openScheduleInitially?: boolean
  defaultDurationMinutes?: number | null
  defaultCallOutcome?: 'connected' | 'no_answer'
  callSessionId?: string
  createTaskAction?: ExtractTasksDialogProps['createTaskAction']
}

/** Shared, always-visible action layout for the lead detail page and side drawer. */
export function LeadQuickActionGroups({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  senderName,
  aiEnabled,
  googleEnabled,
  projects = [],
  meetMembers = [],
  scheduleMembers = [],
  openCallInitially,
  openScheduleInitially,
  defaultDurationMinutes,
  defaultCallOutcome,
  callSessionId,
  createTaskAction,
}: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(openScheduleInitially ?? false)
  const hasTools = googleEnabled || Boolean(aiEnabled && createTaskAction)

  return (
    <section aria-label="Acciones rápidas" className="grid grid-cols-2 gap-1.5">
      <QCallDialog
        leadId={leadId}
        leadPhone={leadPhone}
        leadName={leadName}
        leadEmail={leadEmail}
        senderName={senderName}
        aiEnabled={aiEnabled}
        openInitially={openCallInitially}
        defaultDurationMinutes={defaultDurationMinutes}
        defaultOutcome={defaultCallOutcome}
        callSessionId={callSessionId}
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
      <QEmailDialog leadId={leadId} leadEmail={leadEmail} />

      <ScheduleReminderDialog
        leadId={leadId}
        defaultTitle={`Llamar a ${leadName}`}
        defaultActionType="call"
        members={scheduleMembers}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        trigger={
          <QuickActionTile
            icon={<CalendarDays className="text-muted-foreground size-3.5" />}
            label="Programar"
          />
        }
      />
      <QNoteDialog leadId={leadId} />

      {googleEnabled ? (
        <>
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
        </>
      ) : null}

      {hasTools ? (
        <>
          {googleEnabled ? <GmailSyncButton leadId={leadId} leadEmail={leadEmail} /> : null}
          {aiEnabled && createTaskAction ? (
            <ExtractTasksDialog
              leadId={leadId}
              createTaskAction={createTaskAction}
              trigger={
                <QuickActionTile
                  icon={<ListTodo className="text-muted-foreground size-3.5" />}
                  label="Tareas"
                />
              }
            />
          ) : null}
        </>
      ) : null}
    </section>
  )
}
