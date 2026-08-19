"use client";

import { Button } from "@/components/ui/button";
import { EntityMultiCombobox } from "@/components/ui/entity-multi-combobox";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setProposalTeamMembers } from "../actions";

export type ProposalTeamMember = {
  id: string;
  name: string;
  job_title: string | null;
  avatar_url: string | null;
  github_handle: string | null;
};

export function ProposalTeamSelector({
  proposalId,
  members,
  initialMemberIds,
  locked,
  value,
  onChange,
}: {
  proposalId: string;
  members: ProposalTeamMember[];
  initialMemberIds: string[];
  locked: boolean;
  /** Lets the proposal editor include the team in its single save action. */
  value?: string[];
  onChange?: (memberIds: string[]) => void;
}) {
  const router = useRouter();
  const feedback = useFormFeedback({ successResetMs: 3000 });
  const [uncontrolledIds, setUncontrolledIds] = useState(initialMemberIds);
  const [pending, startTransition] = useTransition();
  const controlled = value !== undefined && onChange !== undefined;
  const selectedIds = controlled ? value : uncontrolledIds;
  const setSelectedIds = controlled ? onChange : setUncontrolledIds;

  function handleSave() {
    feedback.setPending();
    startTransition(async () => {
      const result = await setProposalTeamMembers({
        proposal_id: proposalId,
        member_ids: selectedIds,
      });
      if (!result.ok) {
        feedback.setError(result.error);
        return;
      }
      feedback.setSuccess("Equipo actualizado");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Selecciona solo las personas que trabajarán en este proyecto. Se mostrarán en la
        presentación para el cliente.
      </p>
      <EntityMultiCombobox
        id="proposal-team"
        items={members.map((member) => ({
          id: member.id,
          label: member.name,
          sublabel: member.job_title ?? undefined,
          leading: <MemberAvatar member={member} size="xs" />,
        }))}
        value={selectedIds}
        onChange={setSelectedIds}
        placeholder="Añadir personas…"
        disabled={locked || pending}
        aria-label="Personas que trabajarán en el proyecto"
      />
      {!controlled ? (
        <div className="flex items-center justify-end gap-2">
          <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
          <Button type="button" size="sm" onClick={handleSave} disabled={locked || pending}>
            Guardar equipo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
