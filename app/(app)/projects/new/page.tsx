import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { createProject } from "../actions";
import { GitHubSyncSection } from "../github-sync-section";

export const metadata: Metadata = { title: "Nuevo proyecto · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "planning", label: "Planificación" },
  { value: "active", label: "Activo" },
  { value: "on_hold", label: "En pausa" },
  { value: "done", label: "Terminado" },
  { value: "cancelled", label: "Cancelado" },
];

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  await requireUser();
  const { client_id } = await searchParams;
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
                <Select id="client_id" name="client_id" required defaultValue={client_id ?? ""}>
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
              <FormRow label="Inicio" htmlFor="starts_at">
                <Input id="starts_at" name="starts_at" type="date" />
              </FormRow>
              <FormRow label="Fin previsto" htmlFor="ends_at">
                <Input id="ends_at" name="ends_at" type="date" />
              </FormRow>
            </div>
            <FormRow
              label="Descripción"
              htmlFor="description"
              hint="Resumen del alcance del proyecto."
            >
              <Textarea
                id="description"
                name="description"
                rows={4}
                maxLength={4000}
                placeholder="Objetivos, entregables, criterios de aceptación…"
              />
            </FormRow>
            <GitHubSyncSection idPrefix="new" />
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
