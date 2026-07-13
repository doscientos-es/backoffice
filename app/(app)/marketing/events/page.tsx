import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { listConversionEvents } from "@/lib/conversion-events/queries";
import { formatDateTime, truncate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function eventLabel(name: string): string {
  const labels: Record<string, string> = {
    page_view: "Page view",
    contact_cta_click: "CTA contacto",
    whatsapp_cta_click: "CTA WhatsApp",
    whatsapp_click: "WhatsApp",
    form_submit: "Formulario enviado",
    lead_created: "Lead creado",
  };
  return labels[name] ?? name;
}

function EventBadge({ name }: { name: string }) {
  const variant =
    name === "whatsapp_click" || name === "lead_created"
      ? "success"
      : name.includes("click")
        ? "info"
        : "neutral";
  return <Badge variant={variant}>{eventLabel(name)}</Badge>;
}

export default async function ConversionEventsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(["owner", "admin"]);
  const sp = await searchParams;
  const eventName = param(sp.event);
  const visitorId = param(sp.visitor);
  const events = await listConversionEvents({ eventName, visitorId, limit: 200 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Eventos de conversión"
        description="Journey anónimo de la landing y enlaces con leads cuando el visitante convierte."
        breadcrumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Eventos" }]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Últimos eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No hay eventos con estos filtros.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Página</TableHead>
                  <TableHead>Campaña</TableHead>
                  <TableHead>Visitor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(event.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <EventBadge name={event.event_name} />
                        {event.conversion_step && (
                          <span className="text-xs text-muted-foreground">
                            {event.conversion_step}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {event.lead ? (
                        <Link
                          href={`/leads/${event.lead.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {event.lead.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Anónimo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[260px] flex-col gap-1">
                        <span className="truncate">{event.landing_path ?? "—"}</span>
                        {event.landing_ref && (
                          <span className="text-xs text-muted-foreground">{event.landing_ref}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[event.utm_source, event.utm_medium, event.utm_campaign]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {event.visitor_id ? truncate(event.visitor_id, 14) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
