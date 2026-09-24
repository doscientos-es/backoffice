'use client'

import { Hand } from 'lucide-react'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'

import type { ScheduleMember } from '../../reminders/schedule-reminder-dialog'
import { claimLead } from '../actions'
import type { MeetMember } from '../lead-quick-action-dialogs'
import { LeadQuickActionGroups } from '../lead-quick-action-groups'
import type { ExtractTasksDialogProps } from './extract-tasks-dialog'

type Props = {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  senderName: string
  openCallInitially?: boolean
  openScheduleInitially?: boolean
  defaultDurationMinutes?: number | null
  defaultCallOutcome?: 'connected' | 'no_answer'
  callSessionId?: string
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
  defaultCallOutcome,
  callSessionId,
  claimable,
  aiEnabled,
  googleEnabled,
  projects = [],
  meetMembers = [],
  scheduleMembers = [],
  createTaskAction,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {claimable && <ClaimButton leadId={leadId} />}
      <LeadQuickActionGroups
        leadId={leadId}
        leadName={leadName}
        leadEmail={leadEmail}
        leadPhone={leadPhone}
        senderName={senderName}
        aiEnabled={aiEnabled}
        googleEnabled={googleEnabled}
        projects={projects}
        meetMembers={meetMembers}
        scheduleMembers={scheduleMembers}
        openCallInitially={openCallInitially}
        openScheduleInitially={openScheduleInitially}
        defaultDurationMinutes={defaultDurationMinutes}
        defaultCallOutcome={defaultCallOutcome}
        callSessionId={callSessionId}
        createTaskAction={createTaskAction}
      />
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
