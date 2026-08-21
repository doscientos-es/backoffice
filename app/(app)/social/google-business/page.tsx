import {
  ArrowUpRight as ArrowUpRight,
  ChartBar as BarChart3,
  MapPin as MapPin,
  Star as Star,
  TriangleAlert as TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import {
  GOOGLE_BUSINESS_DAILY_METRICS,
  getGoogleBusinessLocationProfile,
  googleBusinessMissingConfig,
  googleBusinessProfileConfigured,
  listGoogleBusinessMedia,
} from "@/lib/social/google-business";
import { listGoogleBusinessMetrics } from "@/lib/social/repo";
import { GoogleBusinessMediaPanel } from "../_components/google-business-media-panel";
import { GoogleBusinessSyncButton } from "../_components/google-business-sync-button";

const METRIC_LABELS: Record<string, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "Impresiones Maps · escritorio",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "Impresiones Search · escritorio",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "Impresiones Maps · móvil",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "Impresiones Search · móvil",
  BUSINESS_CONVERSATIONS: "Conversaciones",
  BUSINESS_DIRECTION_REQUESTS: "Solicitudes de ruta",
  CALL_CLICKS: "Clics en llamar",
  WEBSITE_CLICKS: "Clics al sitio web",
  BUSINESS_BOOKINGS: "Reservas",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-ES").format(value);
}

export default async function GoogleBusinessPerformancePage() {
  await requireUser();
  const configured = googleBusinessProfileConfigured();
  const missingConfig = googleBusinessMissingConfig();
  const metrics = configured ? await listGoogleBusinessMetrics(30) : [];
  const [profile, media] = configured
    ? await Promise.all([
        getGoogleBusinessLocationProfile().catch(() => null),
        listGoogleBusinessMedia().catch(() => []),
      ])
    : [null, []];
  const totals = new Map<string, number>();
  for (const metric of metrics)
    totals.set(metric.metric, (totals.get(metric.metric) ?? 0) + metric.value);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Google Business Profile"
        description="Rendimiento de tu ficha y accesos rápidos a la gestión de reseñas."
        breadcrumbs={[{ label: "Social", href: "/social" }, { label: "Google Business Profile" }]}
        actions={
          configured ? (
            <GoogleBusinessSyncButton kind="performance" label="Sincronizar métricas" />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/api/social/google-business/auth">Configurar Google</Link>
            </Button>
          )
        }
      />

      {!configured ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">
              Google Business Profile todavía no está conectado.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Faltan variables de produccion para consultar el rendimiento:{" "}
              {missingConfig.join(", ")}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Información de la ficha</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Nombre</p>
                <p className="font-medium">{profile?.title ?? "No disponible"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Categoría</p>
                <p className="font-medium">
                  {profile?.categories?.primaryCategory?.displayName ?? "No disponible"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teléfono</p>
                <p className="font-medium">
                  {profile?.phoneNumbers?.primaryPhone ?? "No disponible"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sitio web</p>
                {profile?.websiteUri ? (
                  <a
                    href={profile.websiteUri}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {profile.websiteUri}
                  </a>
                ) : (
                  <p className="font-medium">No disponible</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Dirección</p>
                <p className="font-medium">
                  {[
                    ...(profile?.storefrontAddress?.addressLines ?? []),
                    profile?.storefrontAddress?.postalCode,
                    profile?.storefrontAddress?.locality,
                  ]
                    .filter(Boolean)
                    .join(", ") || "No disponible"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Fotos de la ficha</CardTitle>
            </CardHeader>
            <CardContent>
              <GoogleBusinessMediaPanel media={media} />
            </CardContent>
          </Card>
          {metrics.length === 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-500/10 p-3 text-sm text-amber-700 dark:border-amber-700/50 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                Todavía no hay métricas guardadas: los números de abajo están a 0 porque nunca se
                han sincronizado, no porque no haya actividad. Pulsa &quot;Sincronizar
                métricas&quot; y revisa el mensaje que aparezca; si Google devuelve un error (por
                ejemplo, la API de rendimiento sin activar), se mostrará ahí en lugar de guardarse
                como cero.
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GOOGLE_BUSINESS_DAILY_METRICS.map((metric) => (
              <Card key={metric}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {METRIC_LABELS[metric] ?? metric}
                  </CardTitle>
                  <BarChart3 className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatNumber(totals.get(metric) ?? 0)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Últimos 30 días</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/social/reviews"
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                <Star className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Gestionar reseñas</p>
                <p className="text-xs text-muted-foreground">Leer y responder reseñas de Google</p>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                <MapPin className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Ficha conectada</p>
                <p className="text-xs text-muted-foreground">
                  Métricas sincronizadas desde Google Business Profile
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
