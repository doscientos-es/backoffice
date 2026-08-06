import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { groupIntoJourneys, type VisitorJourney } from "@/lib/conversion-events/journeys";
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

function JourneyEventRow({ event }: { event: ConversionEventRow }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-2 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <EventBadge name={event.event_name} />
          {event.conversion_step && (
            <span className="text-xs text-muted-foreground">
              {stepLabel(event.conversion_step)}
            </span>
          )}
        </div>
        <span
          className="truncate text-xs text-muted-foreground"
          title={event.landing_path ?? undefined}
        >
          {event.landing_path ?? "—"}
          {event.landing_ref && ` · ref: ${event.landing_ref}`}
        </span>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDateTime(event.created_at)}
      </span>
    </div>
  );
}

function JourneyCard({ journey }: { journey: VisitorJourney }) {
  const visitorParam = journey.visitorIds[0];
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {journey.lead ? (
                <Link href={`/leads/${journey.lead.id}`} className="font-medium hover:text-primary">
                  {journey.lead.name}
                </Link>
              ) : (
                <span className="font-medium text-muted-foreground">Visitante anónimo</span>
              )}
              {journey.lead && <Badge variant="success">Convirtió</Badge>}
              {journey.hasWhatsappClick && <Badge variant="info">Clic en WhatsApp</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Entró por <span className="text-foreground">{journey.entryPath ?? "—"}</span> ·{" "}
              {journey.source}
            </p>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            <p>
              {journey.events.length} {journey.events.length === 1 ? "evento" : "eventos"}
            </p>
            <p>
              {formatDateTime(journey.firstSeen)} — {formatDateTime(journey.lastSeen)}
            </p>
          </div>
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="timeline" className="border-b-0">
            <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline">
              Ver historial completo
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col">
                {journey.events.map((event) => (
                  <JourneyEventRow key={event.id} event={event} />
                ))}
              </div>
              {visitorParam && (
                <Link
                  href={`/marketing/events?visitor=${visitorParam}`}
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  Filtrar solo este visitante
                </Link>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
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
  const events = await listConversionEvents({ eventName, visitorId, limit: 300 });
  const journeys = groupIntoJourneys(events);
  const convertedCount = journeys.filter((j) => j.lead).length;
  const whatsappCount = journeys.filter((j) => j.hasWhatsappClick).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Eventos de conversión"
        description="Historia de cada visitante desde que llega a la landing hasta que convierte, agrupada por persona."
        breadcrumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Eventos" }]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Visitantes" value={journeys.length} />
        <StatCard label="Convirtieron a lead" value={convertedCount} tone="success" />
        <StatCard label="Con clic en WhatsApp" value={whatsappCount} tone="info" />
      </div>

      {(eventName || visitorId) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Filtrando por
            {eventName && (
              <>
                {" "}
                evento <span className="font-medium text-foreground">{eventLabel(eventName)}</span>
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

      {journeys.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay eventos con estos filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {journeys.map((journey) => (
            <JourneyCard key={journey.key} journey={journey} />
          ))}
        </div>
      )}
    </div>
  );
}
