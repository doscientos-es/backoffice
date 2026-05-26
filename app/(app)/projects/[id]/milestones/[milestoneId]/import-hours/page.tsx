import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { importHoursToInvoice } from "./actions";

export const dynamic = "force-dynamic";

function fmtDuration(minutes: number | null) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default async function ImportHoursPage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>;
}) {
  const { id: projectId, milestoneId } = await params;
  await requireRole(["owner", "admin"]);
  const supabase = await createServerClient();

  const [{ data: project }, { data: milestone }, { data: entries }] = await Promise.all([
    supabase.from("projects").select("id, name, client_id, clients(id, name)").eq("id", projectId).is("deleted_at", null).maybeSingle(),
    supabase.from("milestones").select("id, name, amount").eq("id", milestoneId).maybeSingle(),
    supabase
      .from("time_entries")
      .select("id, description, duration_minutes, started_at, hourly_rate, is_billable, member:member_id(name), task:task_id(title)")
      .eq("project_id", projectId)
      .eq("is_billable", true)
      .is("invoiced_at", null)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: true }),
  ]);

  if (!project || !milestone) notFound();

  const client = (project as unknown as { clients: { id: string; name: string } | null }).clients;
  const totalMinutes = (entries ?? []).reduce((s, e) => s + ((e.duration_minutes as number | null) ?? 0), 0);
  const totalHours = totalMinutes / 60;

  async function handleImport(formData: FormData) {
    "use server";
    const entryIds = formData.getAll("entry_ids") as string[];
    const res = await importHoursToInvoice({
      projectId,
      milestoneId,
      entryIds,
    });
    if (res.ok) redirect(`/invoices/${res.invoiceId}`);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title="Importar horas a factura"
        description={`${project.name as string} · ${milestone.name as string}`}
        back={<BackLink href={`/projects/${projectId}/milestones`} label="Volver a hitos" />}
      />

      {!entries || entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay horas facturables pendientes en este proyecto.
          </CardContent>
        </Card>
      ) : (
        <form action={handleImport} className="flex flex-col gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="mb-3 text-sm text-muted-foreground">
                Selecciona las entradas de tiempo que quieres incluir en la nueva factura. Se creará una factura borrador para{" "}
                <strong>{client?.name ?? "el cliente"}</strong>.
              </p>
              <div className="flex flex-col gap-1">
                {entries.map((e) => {
                  const member = (e as unknown as { member: { name: string } | null }).member;
                  const task = (e as unknown as { task: { title: string } | null }).task;
                  const hrs = ((e.duration_minutes as number | null) ?? 0) / 60;
                  const rate = (e.hourly_rate as number | null) ?? 0;
                  return (
                    <label
                      key={e.id as string}
                      className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/40 has-[:checked]:bg-primary/5 has-[:checked]:border-primary/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        name="entry_ids"
                        value={e.id as string}
                        defaultChecked
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{(task?.title) ?? (e.description as string | null) ?? "Sin descripción"}</p>
                        <p className="text-xs text-muted-foreground">
                          {member?.name ?? "—"} · {fmtDuration(e.duration_minutes as number | null)}
                          {rate > 0 && ` · ${(hrs * rate).toFixed(2)} €`}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Total horas facturables</span>
                <strong>{totalHours.toFixed(2)} h</strong>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/projects/${projectId}/milestones`}>Cancelar</a>
            </Button>
            <Button type="submit" size="sm">
              Crear factura borrador
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
