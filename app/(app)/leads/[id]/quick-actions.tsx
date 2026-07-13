"use client";

import { Button } from "@/components/ui/button";
import { CalendarClock, Hand, ListTodo } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { sileo } from "sileo";
import { claimLead } from "../actions";
import {
  type MeetMember,
  QCallDialog,
  QEmailDialog,
  QMeetDialog,
  QMeetNowDialog,
  QNoteDialog,
  QSendEmailDialog,
} from "../lead-quick-action-dialogs";
import { ExtractTasksDialog, type ExtractTasksDialogProps } from "./extract-tasks-dialog";
import { ScheduleReminderDialog } from "./schedule-reminder-dialog";

type Props = {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  claimable?: boolean;
  aiEnabled?: boolean;
  googleEnabled?: boolean;
  projects?: Array<{ id: string; name: string }>;
  meetMembers?: MeetMember[];
  createTaskAction?: ExtractTasksDialogProps["createTaskAction"];
};

export function LeadQuickActions({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  claimable,
  aiEnabled,
  googleEnabled,
  projects = [],
  meetMembers = [],
  createTaskAction,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      {claimable && <ClaimButton leadId={leadId} />}
      <QCallDialog leadId={leadId} leadPhone={leadPhone} leadName={leadName} />
      <QSendEmailDialog leadId={leadId} leadEmail={leadEmail} aiEnabled={aiEnabled} />
      <QEmailDialog leadId={leadId} leadEmail={leadEmail} />
      <QNoteDialog leadId={leadId} />
      {googleEnabled && (
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
      )}
      <ScheduleDialog leadId={leadId} leadName={leadName} />
      {aiEnabled && createTaskAction && (
        <ExtractTasksDialog
          leadId={leadId}
          createTaskAction={createTaskAction}
          trigger={
            <ActionTrigger icon={<ListTodo className="size-4" />} label="Extraer tareas IA" />
          }
        />
      )}
    </div>
  );
}

function ClaimButton({ leadId }: { leadId: string }) {
  const [claimed, setClaimed] = useState(false);
  const [, startTransition] = useTransition();

  if (claimed) return null;

  const onClick = () => {
    setClaimed(true); // optimistic: hide button immediately
    startTransition(async () => {
      const res = await claimLead({ leadId });
      if (!res.ok) {
        setClaimed(false); // revert
        sileo.error({ title: res.error });
      }
    });
  };

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
  );
}

function ActionTrigger({
  icon,
  label,
  ...rest
}: { icon: ReactNode; label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" size="sm" className="w-full justify-start gap-2" {...rest}>
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Button>
  );
}

// ---------------- SCHEDULE (reminder) ----------------

function ScheduleDialog({ leadId, leadName }: { leadId: string; leadName: string }) {
  return (
    <ScheduleReminderDialog
      leadId={leadId}
      defaultTitle={`Llamar a ${leadName}`}
      trigger={<ActionTrigger icon={<CalendarClock className="size-4" />} label="Agendar" />}
    />
  );
}
