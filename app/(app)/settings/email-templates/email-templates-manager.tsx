"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { appendSignature, renderTemplate } from "@/lib/email/templates";
import { formatDate } from "@/lib/utils";
import { Pencil, Plus, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  type EmailTemplate,
  type EmailTemplateInput,
  createEmailTemplate,
  toggleEmailTemplateActive,
  updateEmailTemplate,
} from "./actions";

type Props = { templates: EmailTemplate[] };

const EMPTY_FORM: EmailTemplateInput = {
  name: "",
  slug: "",
  subject: "",
  body_html: "",
  include_signature: true,
};

/** Datos ficticios de un lead para previsualizar la plantilla en tiempo real. */
const SAMPLE_VARS: Record<string, string> = {
  nombre: "María García",
  empresa: "Acme Studio",
  email: "maria.garcia@acme.com",
  sender_name: "Pol Gubau",
};

/** Firma de ejemplo usada únicamente en la vista previa. */
const SAMPLE_SIGNATURE =
  '<div style="font-size:13px;color:#666;line-height:1.5;margin-top:4px">' +
  '<strong style="color:#2A4227">Pol Gubau</strong><br/>' +
  "doscientos · Estudio de producto<br/>" +
  '<a href="mailto:pol@doscientos.studio">pol@doscientos.studio</a>' +
  "</div>";

export function EmailTemplatesManager({ templates }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<EmailTemplateInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const previewSubject = useMemo(() => renderTemplate(form.subject, SAMPLE_VARS), [form.subject]);
  const previewBody = useMemo(() => {
    const rendered = renderTemplate(form.body_html, SAMPLE_VARS);
    return form.include_signature ? appendSignature(rendered, SAMPLE_SIGNATURE) : rendered;
  }, [form.body_html, form.include_signature]);

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
                <tr
                  key={tpl.id}
                  className="border-t border-border hover:bg-muted/20 transition-colors"
                >
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
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(tpl)}
                        title="Editar"
                      >
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
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-5xl max-h-[92vh]">
          <form onSubmit={handleSubmit} className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b border-border px-5 py-4">
              <DialogTitle>{editing ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
              <DialogDescription>
                Edita los campos y comprueba a la derecha cómo se verá el email con un lead de
                ejemplo.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
              {/* ── Columna de edición ── */}
              <div className="flex flex-col gap-4 overflow-y-auto p-5">
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
                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                  <Label htmlFor="tpl-body">Cuerpo HTML</Label>
                  <Textarea
                    id="tpl-body"
                    value={form.body_html}
                    onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))}
                    rows={16}
                    placeholder="<p>Hola {{nombre}},</p>..."
                    required
                    className="min-h-65 flex-1 font-mono text-xs"
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
              </div>

              {/* ── Columna de vista previa en tiempo real ── */}
              <div className="flex flex-col gap-3 overflow-y-auto border-t border-border bg-muted/30 p-5 lg:border-t-0 lg:border-l">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    Vista previa en tiempo real
                  </p>
                  <Badge variant="neutral" className="text-[10px]">
                    Lead de ejemplo
                  </Badge>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
                  <div className="space-y-1 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-400">Asunto</p>
                    <p className="text-sm font-medium text-neutral-900">
                      {previewSubject || (
                        <span className="italic text-neutral-400">(sin asunto)</span>
                      )}
                    </p>
                  </div>
                  <div className="min-h-65 px-4 py-3 text-sm text-neutral-800">
                    {form.body_html.trim() ? (
                      <div
                        className="[&_a]:text-[#2A4227] [&_a]:underline"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: vista previa con datos internos de ejemplo
                        dangerouslySetInnerHTML={{ __html: previewBody }}
                      />
                    ) : (
                      <p className="italic text-neutral-400">El cuerpo del email aparecerá aquí…</p>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground/80">Datos del lead de ejemplo</p>
                  <ul className="space-y-0.5">
                    <li>
                      <code className="font-mono">{"{{nombre}}"}</code> → {SAMPLE_VARS.nombre}
                    </li>
                    <li>
                      <code className="font-mono">{"{{empresa}}"}</code> → {SAMPLE_VARS.empresa}
                    </li>
                    <li>
                      <code className="font-mono">{"{{email}}"}</code> → {SAMPLE_VARS.email}
                    </li>
                    <li>
                      <code className="font-mono">{"{{sender_name}}"}</code> →{" "}
                      {SAMPLE_VARS.sender_name}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
              {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
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
