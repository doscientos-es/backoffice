'use client'

import { ListTodo, Phone } from 'lucide-react'
import { useState } from 'react'

import { GoogleCalendarIcon } from '@/components/icons/google-calendar-icon'

import { type ScheduleMember, ScheduleReminderDialog } from '../reminders/schedule-reminder-dialog'
import { ExtractTasksDialog, type ExtractTasksDialogProps } from './[id]/extract-tasks-dialog'
import { GmailSyncButton } from './[id]/gmail-sync-button'
import { LeadCallLink, LeadContactSaveButton } from './[id]/phone-actions'
import {
  type MeetMember,
  QCallDialog,
  QEmailDialog,
  QMeetDialog,
  QMeetNowDialog,
  QNoteDialog,
  QSendEmailDialog,
  QuickActionTile,
  QWhatsAppDialog,
} from './lead-quick-action-dialogs'

type Props = {
  leadId: string
  leadName: string
  leadAlias?: string | null
  leadCompany?: string | null
  leadEmail: string | null
  leadPhone: string | null
  leadLanguage?: string | null
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
  leadAlias,
  leadCompany,
  leadEmail,
  leadPhone,
  leadLanguage,
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
      {leadPhone && (
        <LeadCallLink
          leadId={leadId}
          phone={leadPhone}
          className="flex h-8 w-full min-w-0 items-center justify-start gap-2 rounded-md border border-border/80 bg-card/60 px-2.5 text-left text-xs font-medium transition-colors hover:border-foreground/25 hover:bg-muted/60"
        >
          <Phone className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">Llamar</span>
        </LeadCallLink>
      )}
      {leadPhone && (
        <LeadContactSaveButton
          leadId={leadId}
          name={leadName}
          phone={leadPhone}
          email={leadEmail}
          company={leadCompany}
        />
      )}
      <QCallDialog
        leadId={leadId}
        leadPhone={leadPhone}
        leadLanguage={leadLanguage}
        leadName={leadName}
        leadAlias={leadAlias}
        leadCompany={leadCompany}
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
        leadAlias={leadAlias}
        leadCompany={leadCompany}
        leadEmail={leadEmail}
        leadPhone={leadPhone}
        leadLanguage={leadLanguage}
        senderName={senderName}
        aiEnabled={aiEnabled}
      />
      <QSendEmailDialog
        leadId={leadId}
        leadEmail={leadEmail}
        defaultLanguage={leadLanguage}
        aiEnabled={aiEnabled}
      />
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
            icon={<GoogleCalendarIcon className="h-3.5 w-auto shrink-0" />}
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
                  icon={<ListTodo className="size-3.5 text-muted-foreground" />}
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
