import { Star } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import {
  googleBusinessMissingConfig,
  googleBusinessProfileConfigured,
} from "@/lib/social/google-business";
import { listGoogleBusinessReviewViews } from "@/lib/social/repo";
import { GoogleBusinessSyncButton } from "../_components/google-business-sync-button";
import { GoogleReviewCard } from "../_components/google-review-card";

type SearchParams = Promise<{ rating?: string; replied?: string }>;

const RATINGS = ["all", "FIVE", "FOUR", "THREE", "TWO", "ONE"] as const;

function filterHref(rating: string, replied: string) {
  const params = new URLSearchParams();
  if (rating !== "all") params.set("rating", rating);
  if (replied !== "all") params.set("replied", replied);
  const query = params.toString();
  return `/social/reviews${query ? `?${query}` : ""}`;
}

export default async function GoogleBusinessReviewsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const params = await searchParams;
  const rating = RATINGS.includes(params.rating as (typeof RATINGS)[number])
    ? (params.rating ?? "all")
    : "all";
  const replied =
    params.replied === "replied" || params.replied === "pending" ? params.replied : "all";
  const configured = googleBusinessProfileConfigured();
  const missingConfig = googleBusinessMissingConfig();
  const reviews = await listGoogleBusinessReviewViews({
    rating,
    replied: replied as "all" | "replied" | "pending",
  });
  const pendingCount = reviews.filter((review) => !review.replied).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reseñas de Google"
        description="Consulta y responde las reseñas de tu ficha de Google Business Profile."
        breadcrumbs={[{ label: "Social", href: "/social" }, { label: "Reseñas" }]}
        actions={
          configured ? (
            <GoogleBusinessSyncButton kind="reviews" label="Sincronizar reseñas" />
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
              Faltan variables de produccion para sincronizar resenas: {missingConfig.join(", ")}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Filtrar:</span>
            {RATINGS.map((value) => (
              <Button
                key={value}
                asChild
                variant={rating === value ? "secondary" : "outline"}
                size="sm"
              >
                <Link href={filterHref(value, replied)}>
                  {value === "all"
                    ? "Todas"
                    : `${value === "FIVE" ? "5" : value === "FOUR" ? "4" : value === "THREE" ? "3" : value === "TWO" ? "2" : "1"} estrellas`}
                </Link>
              </Button>
            ))}
            {(["all", "pending", "replied"] as const).map((value) => (
              <Button
                key={value}
                asChild
                variant={replied === value ? "secondary" : "outline"}
                size="sm"
              >
                <Link href={filterHref(rating, value)}>
                  {value === "all" ? "Todas" : value === "pending" ? "Pendientes" : "Respondidas"}
                </Link>
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="size-4 fill-amber-400 text-amber-400" />
            {reviews.length} reseñas cargadas · {pendingCount} pendientes de respuesta
          </div>
          {reviews.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {reviews.map((review) => (
                <GoogleReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay reseñas para los filtros seleccionados. Sincroniza para cargar las últimas
                reseñas.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
