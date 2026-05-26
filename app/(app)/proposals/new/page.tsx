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
import { createProposal } from "../actions";
import { LineItemsEditor } from "./line-items-editor";

export const metadata: Metadata = { title: "Nueva propuesta · doscientos" };
export const dynamic = "force-dynamic";

export default async function NewProposalPage({
  searchParams,
}: { searchParams: Promise<{ client_id?: string; project_id?: string }> }) {
  await requireUser();
  const { client_id, project_id } = await searchParams;

  const supabase = await createServerClient();
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("projects").select("id, name, client_id").is("deleted_at", null).order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva propuesta"
        back={<BackLink href="/proposals" label="Volver a propuestas" />}
      />
      <form action={createProposal} className="flex flex-col gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormRow label="Cliente" htmlFor="client_id" required hint="Destinatario de la propuesta.">
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
              <FormRow
                label="Proyecto"
                htmlFor="project_id"
                hint="Opcional. Asocia la propuesta a un proyecto existente."
              >
                <Select id="project_id" name="project_id" defaultValue={project_id ?? ""}>
                  <option value="">— Sin proyecto —</option>
                  {projects?.map((p) => (
                    <option key={p.id as string} value={p.id as string}>
                      {p.name as string}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Título" htmlFor="title" required>
                <Input
                  id="title"
                  name="title"
                  required
                  maxLength={200}
                  autoFocus
                  placeholder="Propuesta de servicios"
                />
              </FormRow>
              <FormRow label="Válida hasta" htmlFor="valid_until" hint="Fecha límite de aceptación.">
                <Input id="valid_until" name="valid_until" type="date" />
              </FormRow>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 text-sm font-semibold">Líneas</h2>
            <LineItemsEditor />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <FormRow
              label="Notas"
              htmlFor="notes"
              hint="Condiciones generales, alcance o aclaraciones para el cliente."
            >
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                maxLength={4000}
                placeholder="Condiciones, alcance, observaciones…"
              />
            </FormRow>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/proposals">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Creando…">Crear propuesta</SubmitButton>
        </div>
      </form>
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
