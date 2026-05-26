import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, Flag } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  completed: "success",
  invoiced: "info",
  paid: "success",
  cancelled: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  completed: "Completado",
  invoiced: "Facturado",
  paid: "Pagado",
  cancelled: "Cancelado",
};

export default async function MilestonesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const [{ data: project }, { data: milestones }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase
      .from("milestones")
      .select("id, name, description, percentage, amount, start_date, due_date, completed_at, completion_percentage, color, is_payment_milestone, status, invoice_id")
      .eq("project_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  if (!project) notFound();

  const paymentDue = milestones?.filter(
    (m) => m.is_payment_milestone && (m.completion_percentage as number) === 100 && m.status === "completed",
  ) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Hitos"
        description={project.name as string}
        back={<BackLink href={`/projects/${id}`} label="Volver al proyecto" />}
        actions={
          <Button asChild size="sm">
            <Link href={`/projects/${id}/milestones/new`}>Nuevo hito</Link>
          </Button>
        }
      />

      {/* Payment milestone ready-to-invoice banners */}
      {paymentDue.map((m) => (
        <div
          key={m.id as string}
          className="flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <span className="text-sm font-medium">
              Hito de pago completado: <strong>{m.name as string}</strong>
            </span>
          </div>
          <Link
            href={`/projects/${id}/milestones/${m.id}/import-hours`}
            className="shrink-0 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-success-foreground hover:bg-success/90 transition-colors"
          >
            Importar horas a factura
          </Link>
        </div>
      ))}

      {/* Milestone list */}
      {!milestones || milestones.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Sin hitos. Crea el primero para organizar las entregas del proyecto.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {milestones.map((m) => {
            const pct = m.completion_percentage as number;
            return (
              <Card key={m.id as string}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: (m.color as string | null) ?? "#6366f1" }}
                    />
                    {m.is_payment_milestone && (
                      <span title="Hito de pago">
                        <Flag className="h-3.5 w-3.5 shrink-0 text-warning" />
                      </span>
                    )}
                    <CardTitle className="text-base truncate">{m.name as string}</CardTitle>
                  </div>
                  <Badge variant={STATUS_VARIANT[(m.status as string | null) ?? "pending"]}>
                    {STATUS_LABEL[(m.status as string | null) ?? "pending"] ?? m.status}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {(m.description as string | null) && (
                    <p className="text-sm text-muted-foreground">{m.description as string}</p>
                  )}
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {(m.amount as number | null) != null && (
                      <span>
                        Importe:{" "}
                        <strong className="text-foreground">
                          {Number(m.amount).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                        </strong>
                      </span>
                    )}
                    {(m.start_date as string | null) && (
                      <span>Inicio: {formatDate(m.start_date as string)}</span>
                    )}
                    {(m.due_date as string | null) && (
                      <span>Vence: {formatDate(m.due_date as string)}</span>
                    )}
                    {(m.completed_at as string | null) && (
                      <span className="text-success">✓ Completado {formatDate(m.completed_at as string)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
