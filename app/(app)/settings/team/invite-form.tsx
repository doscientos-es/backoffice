"use client";

import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { MemberRole } from "@/lib/auth";
import { useRef } from "react";
import { inviteTeamMember } from "./actions";

interface Props {
  actorRole: MemberRole;
}

export function InviteForm({ actorRole }: Props) {
  const feedback = useFormFeedback();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    feedback.setPending();
    const result = await inviteTeamMember(fd);
    if (result.ok) {
      feedback.setSuccess("Invitación enviada");
      formRef.current?.reset();
    } else {
      feedback.setError(result.error);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_180px]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite_name" className="text-xs font-medium">Nombre</Label>
          <Input id="invite_name" name="name" required placeholder="Nombre completo" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite_email" className="text-xs font-medium">Email</Label>
          <Input id="invite_email" name="email" type="email" required placeholder="nombre@empresa.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite_role" className="text-xs font-medium">Rol</Label>
          <Select id="invite_role" name="role" defaultValue="member">
            {actorRole === "owner" ? <option value="owner">Propietario</option> : null}
            <option value="admin">Administrador</option>
            <option value="member">Miembro</option>
            <option value="viewer">Solo lectura</option>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <FormFeedback
          state={feedback.state}
          pendingLabel="Enviando…"
          successLabel="Invitación enviada"
        />
        <Button type="submit" size="sm" disabled={feedback.pending}>
          {feedback.pending ? "Enviando…" : "Enviar invitación"}
        </Button>
      </div>
    </form>
  );
}
