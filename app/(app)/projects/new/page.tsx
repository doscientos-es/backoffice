import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createProject } from "../actions";

export const metadata = { title: "Nuevo proyecto · doscientos" };

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
              <F label="Cliente" id="client_id" required>
                <Select id="client_id" name="client_id" required>
                  <option value="">— Selecciona cliente —</option>
                  {clients?.map((c) => (
                    <option key={c.id as string} value={c.id as string}>
                      {c.name as string}
                    </option>
                  ))}
                </Select>
              </F>
              <F label="Nombre del proyecto" id="name" required>
                <Input id="name" name="name" required maxLength={160} autoFocus />
              </F>
              <F label="Estado" id="status">
                <Select id="status" name="status" defaultValue="planning">
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </F>
              <F label="Repositorio GitHub" id="github_repo">
                <Input id="github_repo" name="github_repo" type="url"
                  placeholder="https://github.com/org/repo" />
              </F>
              <F label="Inicio" id="starts_at">
                <Input id="starts_at" name="starts_at" type="date" />
              </F>
              <F label="Fin previsto" id="ends_at">
                <Input id="ends_at" name="ends_at" type="date" />
              </F>
            </div>
            <F label="Descripción" id="description">
              <Textarea id="description" name="description" rows={4} maxLength={4000} />
            </F>
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" size="sm">Crear proyecto</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, id, required, children }: {
  label: string; id: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
