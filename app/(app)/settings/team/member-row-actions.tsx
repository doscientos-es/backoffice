"use client";

import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Select } from "@/components/ui/select";
import type { MemberRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { deactivateMember, reactivateMember, updateMemberRole } from "./actions";

interface Props {
  memberId: string;
  role: MemberRole;
  isSelf: boolean;
  isDeactivated: boolean;
  actorRole: MemberRole;
}

export function MemberRowActions({ memberId, role, isSelf, isDeactivated, actorRole }: Props) {
  const feedback = useFormFeedback();
  const router = useRouter();
  const canEditOwner = actorRole === "owner";
  const targetIsOwner = role === "owner";
  const disabledRoleSelect = isSelf || isDeactivated || (targetIsOwner && !canEditOwner);

  async function onRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as MemberRole;
    if (next === role) return;
    feedback.setPending();
    const res = await updateMemberRole({ memberId, role: next });
    if (!res.ok) {
      feedback.setError(res.error);
      e.target.value = role;
      return;
    }
    feedback.setSuccess("Rol actualizado");
    router.refresh();
  }

  async function onToggleActive() {
    feedback.setPending();
    const res = isDeactivated
      ? await reactivateMember({ memberId })
      : await deactivateMember({ memberId });
    if (!res.ok) {
      feedback.setError(res.error);
      return;
    }
    feedback.setSuccess(isDeactivated ? "Reactivado" : "Desactivado");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
      <Select
        defaultValue={role}
        disabled={disabledRoleSelect || feedback.pending}
        className="h-8 w-36"
        onChange={onRoleChange}
        aria-label="Rol"
      >
        {canEditOwner ? <option value="owner">Propietario</option> : null}
        <option value="admin">Administrador</option>
        <option value="member">Miembro</option>
        <option value="viewer">Solo lectura</option>
      </Select>
      <Button
        type="button"
        size="sm"
        variant={isDeactivated ? "outline" : "outline"}
        disabled={isSelf || feedback.pending || (targetIsOwner && !canEditOwner)}
        onClick={onToggleActive}
      >
        {isDeactivated ? "Reactivar" : "Desactivar"}
      </Button>
    </div>
  );
}
