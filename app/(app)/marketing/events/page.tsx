import Link from "next/link";
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
import { eventLabel, stepLabel } from "@/lib/conversion-events/labels";
import { type ConversionEventRow, listConversionEvents } from "@/lib/conversion-events/queries";
import { formatDateTime, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function EventBadge({ name }: { name: string }) {
  const variant =
    name === "whatsapp_click" || name === "lead_created"
      ? "success"
      : name.includes("diagnostic")
        ? "info"
        : "neutral";
  return <Badge variant={variant}>{eventLabel(name)}</Badge>;
}

/** Dominio legible de una URL de referrer, o null si no se puede parsear. */
function referrerHost(referrer: string): string | null {
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Conclusión sobre de dónde viene el tráfico de este evento: prioriza UTMs
 * (campañas activas), luego el referrer, y por defecto asume que es tráfico
 * directo dentro de la propia web (típico de un clic en el pie o en el menú).
 */
function trafficSource(event: ConversionEventRow): string {
  if (event.utm_source) {
    const medium = event.utm_medium ? ` / ${event.utm_medium}` : "";
    const campaign = event.utm_campaign ? ` · ${event.utm_campaign}` : "";
    return `${event.utm_source}${medium}${campaign}`;
  }
  if (event.referrer) {
    const host = referrerHost(event.referrer);
    if (host?.includes("google")) return "Google (orgánico)";
    if (host?.includes("facebook") || host?.includes("instagram")) return "Meta (orgánico)";
    if (host) return `Referido: ${host}`;
  }
  return "Directo";
}

export default async function ConversionEventsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
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
          {(eventName || visitorId) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Filtrando por
                {eventName && (
                  <>
                    {" "}
                    evento{" "}
                    <span className="font-medium text-foreground">{eventLabel(eventName)}</span>
                  </>
                )}
                {eventName && visitorId && " y"}
                {visitorId && (
                  <>
                    {" "}
                    visitante{" "}
                    <span className="font-medium text-foreground">{truncate(visitorId, 14)}</span>
                  </>
                )}
              </span>
              <Link href="/marketing/events" className="text-primary hover:underline">
                Quitar filtro
              </Link>
            </div>
          )}
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
                  <TableHead>Página</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Lead</TableHead>
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
                            {stepLabel(event.conversion_step)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-65 flex-col gap-1">
                        <span className="truncate" title={event.landing_path ?? undefined}>
                          {event.landing_path ?? "—"}
                        </span>
                        {event.landing_ref && (
                          <span className="text-xs text-muted-foreground">
                            ref: {event.landing_ref}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {trafficSource(event)}
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
                    <TableCell className="text-xs text-muted-foreground">
                      {event.visitor_id ? (
                        <Link
                          href={`/marketing/events?visitor=${event.visitor_id}`}
                          className="hover:text-primary hover:underline"
                          title={event.visitor_id}
                        >
                          {truncate(event.visitor_id, 14)}
                        </Link>
                      ) : (
                        "—"
                      )}
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
