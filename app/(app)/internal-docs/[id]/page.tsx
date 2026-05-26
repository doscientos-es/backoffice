import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteInternalDoc } from "../actions";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  legal: "Legal", hr: "RRHH", finance: "Finanzas",
  templates: "Plantillas", policies: "Políticas",
  meetings: "Actas", other: "Otro",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase.from("internal_documents").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ? `${data.name as string} · doscientos` : "Documento · doscientos" };
}

export default async function InternalDocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const supabase = await createServerClient();
  const { data: doc } = await supabase
    .from("internal_documents")
    .select(
      "id, name, description, category, mime_type, size_bytes, version, visibility, effective_date, expires_at, created_at, uploaded_by, deleted_at, team_members:uploaded_by(name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!doc) notFound();

  const isAdmin = ["owner", "admin"].includes(user.role);
  const isAdminsOnly = (doc.visibility as string) === "admins_only";

  // Non-admins cannot see admins_only docs (RLS also guards this, belt + suspenders)
  if (isAdminsOnly && !isAdmin) notFound();

  const uploaderName =
    (doc.team_members as { name: string } | null)?.name ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={doc.name as string}
        breadcrumbs={[
          { label: "Docs internos", href: "/internal-docs" },
          { label: doc.name as string },
        ]}
        actions={
          <Button asChild size="sm">
            <Link href={`/api/internal-docs/${id}/download`} target="_blank" rel="noopener noreferrer">
              <Download className="size-3.5" />
              Descargar
            </Link>
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Detalles</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid>
            <DetailRow label="Categoría">
              {CATEGORY_LABELS[(doc.category as string) ?? "other"]}
            </DetailRow>
            <DetailRow label="Visibilidad">
              {isAdminsOnly ? (
                <Badge variant="warning">Solo admins</Badge>
              ) : (
                <Badge variant="neutral">Todo el equipo</Badge>
              )}
            </DetailRow>
            <DetailRow label="Tipo">
              {(doc.mime_type as string | null) ?? "—"}
            </DetailRow>
            <DetailRow label="Tamaño">
              {doc.size_bytes ? `${Math.ceil(Number(doc.size_bytes) / 1024)} KB` : "—"}
            </DetailRow>
            <DetailRow label="Versión">v{doc.version as number}</DetailRow>
            {doc.effective_date && (
              <DetailRow label="Vigencia desde">
                {formatDate(doc.effective_date as string)}
              </DetailRow>
            )}
            {doc.expires_at && (
              <DetailRow label="Expira">
                {formatDate(doc.expires_at as string)}
              </DetailRow>
            )}
            <DetailRow label="Subido por">{uploaderName}</DetailRow>
            <DetailRow label="Fecha">{formatDate(doc.created_at as string)}</DetailRow>
          </DetailGrid>

          {doc.description && (
            <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
              {doc.description as string}
            </p>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="max-w-2xl border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de peligro</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={deleteInternalDoc} className="flex items-center gap-4">
              <input type="hidden" name="id" value={id} />
              <p className="flex-1 text-sm text-muted-foreground">
                Eliminar este documento de forma permanente. Esta acción no se puede deshacer.
              </p>
              <SubmitButton variant="destructive" size="sm" pendingLabel="Eliminando…">
                Eliminar
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
