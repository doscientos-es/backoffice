'use client'

import { ChevronDown, ListTodo, Phone } from 'lucide-react'
import { useId, useState } from 'react'

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
  collapsible?: boolean
}

/** Shared action layout for the lead detail page and side drawer. */
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
  collapsible = false,
}: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(openScheduleInitially ?? false)
  const [expanded, setExpanded] = useState(Boolean(openCallInitially))
  const secondaryId = useId()
  const hasTools = googleEnabled || Boolean(aiEnabled && createTaskAction)

  const secondaryActions = (
    <>
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
        googleEnabled={googleEnabled}
        openInitially={openCallInitially}
        defaultDurationMinutes={defaultDurationMinutes}
        defaultOutcome={defaultCallOutcome}
        callSessionId={callSessionId}
      />
      <QEmailDialog leadId={leadId} leadEmail={leadEmail} />

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
    </>
  )

  return (
    <section aria-label="Acciones rápidas" className="grid grid-cols-2 gap-2">
      {leadPhone && (
        <LeadCallLink
          leadId={leadId}
          phone={leadPhone}
          className="flex h-9 w-full min-w-0 items-center justify-start gap-2 rounded-md bg-primary px-3 text-left text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Phone className="size-4 shrink-0" />
          <span className="truncate">Llamar</span>
        </LeadCallLink>
      )}
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
      {collapsible ? (
        <div className="col-span-2">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={secondaryId}
            onClick={() => setExpanded((value) => !value)}
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Más acciones
            <ChevronDown className={expanded ? 'size-4 rotate-180' : 'size-4'} aria-hidden />
          </button>
          <div id={secondaryId} hidden={!expanded} className="mt-2 grid grid-cols-2 gap-2">
            {secondaryActions}
          </div>
        </div>
      ) : (
        secondaryActions
      )}
    </section>
  )
}
