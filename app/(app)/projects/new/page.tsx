import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { createProject } from "../actions";

export const metadata: Metadata = { title: "Nuevo proyecto · doscientos" };

const STATUS_OPTIONS = [
  { value: "planning", label: "Planificación" },
  { value: "active", label: "Activo" },
  { value: "on_hold", label: "En pausa" },
  { value: "done", label: "Terminado" },
  { value: "cancelled", label: "Cancelado" },
];

export default async function NewProjectPage() {
  await requireUser();
  const supabase = await createServerClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo proyecto"
        back={<BackLink href="/projects" label="Volver a proyectos" />}
      />
      <Card>
        <CardContent className="pt-6">
          <form action={createProject} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormRow
                label="Cliente"
                htmlFor="client_id"
                required
                hint="Cliente al que pertenece el proyecto."
              >
                <Select id="client_id" name="client_id" required defaultValue="">
                  <option value="" disabled>
                    — Selecciona cliente —
                  </option>
                  {clients?.map((c) => (
                    <option key={c.id as string} value={c.id as string}>
                      {c.name as string}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Nombre del proyecto" htmlFor="name" required>
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={160}
                  autoFocus
                  placeholder="Rediseño web 2026"
                />
              </FormRow>
              <FormRow label="Estado" htmlFor="status" hint="Puedes cambiarlo más tarde.">
                <Select id="status" name="status" defaultValue="planning">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow
                label="Repositorio GitHub"
                htmlFor="github_repo"
                hint="Opcional. URL completa del repositorio."
              >
                <Input
                  id="github_repo"
                  name="github_repo"
                  type="url"
                  inputMode="url"
                  placeholder="https://github.com/org/repo"
                />
              </FormRow>
              <FormRow label="Inicio" htmlFor="starts_at">
                <Input id="starts_at" name="starts_at" type="date" />
              </FormRow>
              <FormRow label="Fin previsto" htmlFor="ends_at">
                <Input id="ends_at" name="ends_at" type="date" />
              </FormRow>
            </div>
            <FormRow label="Descripción" htmlFor="description" hint="Resumen del alcance del proyecto.">
              <Textarea
                id="description"
                name="description"
                rows={4}
                maxLength={4000}
                placeholder="Objetivos, entregables, criterios de aceptación…"
              />
            </FormRow>
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/projects">Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Creando…">Crear proyecto</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function F({
  label,
  id,
  required,
  hint,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
