"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitProjectRequest } from "./actions";

export function ProjectRequestForm({ token }: { token: string }) {
  const router = useRouter();
  const feedback = useFormFeedback();
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    feedback.setPending();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await submitProjectRequest({
      token,
      category: data.get("category")?.toString(),
      subject: data.get("subject")?.toString(),
      body: data.get("body")?.toString(),
      requesterName: data.get("requester_name")?.toString(),
      requesterEmail: data.get("requester_email")?.toString(),
      website: data.get("website")?.toString(),
    });
    if (!result.ok) return feedback.setError(result.error);
    form.reset();
    setSent(true);
    feedback.setSuccess("Solicitud enviada");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="requester-name" className="mb-1 block text-sm font-medium">Nombre</label>
        <Input id="requester-name" name="requester_name" required maxLength={160} />
      </div>
      <div>
        <label htmlFor="requester-email" className="mb-1 block text-sm font-medium">Email</label>
        <Input id="requester-email" name="requester_email" type="email" maxLength={254} />
      </div>
      <div>
        <label htmlFor="request-category" className="mb-1 block text-sm font-medium">Tipo</label>
        <Select id="request-category" name="category" defaultValue="question">
          <option value="question">Consulta</option>
          <option value="incident">Incidencia</option>
          <option value="change">Cambio</option>
          <option value="material">Entrega de material</option>
          <option value="maintenance">Mantenimiento</option>
          <option value="complaint">Queja</option>
        </Select>
      </div>
      <div>
        <label htmlFor="request-subject" className="mb-1 block text-sm font-medium">Asunto</label>
        <Input id="request-subject" name="subject" required maxLength={160} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="request-body" className="mb-1 block text-sm font-medium">Descripción</label>
        <Textarea id="request-body" name="body" required rows={5} maxLength={4000} />
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="request-website">Website</label>
        <input id="request-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <FormFeedback state={feedback.state} />
        <Button type="submit" disabled={feedback.pending}>
          {feedback.pending ? "Enviando…" : sent ? "Enviar otra solicitud" : "Enviar solicitud"}
        </Button>
      </div>
    </form>
  );
}