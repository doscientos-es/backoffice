"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { Pencil, Plus, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createEmailTemplate,
  toggleEmailTemplateActive,
  updateEmailTemplate,
  type EmailTemplate,
  type EmailTemplateInput,
} from "./actions";

type Props = { templates: EmailTemplate[] };

const EMPTY_FORM: EmailTemplateInput = {
  name: "",
  slug: "",
  subject: "",
  body_html: "",
  include_signature: true,
};

export function EmailTemplatesManager({ templates }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<EmailTemplateInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEdit(tpl: EmailTemplate) {
    setEditing(tpl);
    setForm({
      name: tpl.name,
      slug: tpl.slug,
      subject: tpl.subject,
      body_html: tpl.body_html,
      include_signature: tpl.include_signature,
    });
    setError(null);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = editing
        ? await updateEmailTemplate(editing.id, form)
        : await createEmailTemplate(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function handleToggle(tpl: EmailTemplate) {
    startTransition(async () => {
      await toggleEmailTemplateActive(tpl.id, !tpl.active);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5 mr-1.5" />
          Nueva plantilla
        </Button>
      </div>

      {templates.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Sin plantillas</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nombre / Slug</th>
                <th className="px-4 py-2.5 font-medium">Asunto</th>
                <th className="px-4 py-2.5 font-medium">Variables</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Actualizado</th>
                <th className="px-4 py-2.5 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 align-middle">
                    <p className="font-medium">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{tpl.slug}</p>
                  </td>
                  <td className="px-4 py-2.5 align-middle text-muted-foreground max-w-[220px] truncate">
                    {tpl.subject}
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex flex-wrap gap-1">
                      {tpl.variables.map((v) => (
                        <Badge key={v} variant="neutral" className="font-mono text-[10px]">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <Badge variant={tpl.active ? "success" : "neutral"}>
                      {tpl.active ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 align-middle text-muted-foreground text-xs">
                    {formatDate(tpl.updated_at)}
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(tpl)} title="Editar">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggle(tpl)}
                        title={tpl.active ? "Desactivar" : "Activar"}
                        disabled={isPending}
                      >
                        <Power className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-name">Nombre</Label>
                <Input
                  id="tpl-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Seguimiento de propuesta"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-slug">Slug</Label>
                <Input
                  id="tpl-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="seguimiento-propuesta"
                  required
                  disabled={!!editing}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-subject">Asunto</Label>
              <Input
                id="tpl-subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Seguimiento: {{nombre}}"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-body">Cuerpo HTML</Label>
              <Textarea
                id="tpl-body"
                value={form.body_html}
                onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))}
                rows={10}
                placeholder="<p>Hola {{nombre}},</p>..."
                required
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles: <code className="font-mono">{"{{nombre}}"}</code>{" "}
                <code className="font-mono">{"{{empresa}}"}</code>{" "}
                <code className="font-mono">{"{{email}}"}</code>{" "}
                <code className="font-mono">{"{{sender_name}}"}</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="tpl-sig"
                checked={form.include_signature}
                onCheckedChange={(v) => setForm((f) => ({ ...f, include_signature: !!v }))}
              />
              <Label htmlFor="tpl-sig" className="cursor-pointer">
                Añadir firma del remitente
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <SubmitButton loading={isPending}>
                {editing ? "Guardar cambios" : "Crear plantilla"}
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
