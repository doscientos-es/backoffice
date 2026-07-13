import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AssetsGrid, type BrandAsset } from "./_components/assets-grid";

export const metadata: Metadata = { title: "Assets de marca · doscientos" };
export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const user = await requireUser();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("brand_assets")
    .select("id, name, description, category, mime_type, size_bytes, public_url, created_at")
    .is("deleted_at", null)
    .order("category")
    .order("created_at", { ascending: false });

  const isAdmin = user.role === "owner" || user.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Assets de marca"
        description="Logos, isotipos y recursos visuales de la empresa. Las URLs son públicas y permanentes."
        actions={
          user.role !== "viewer" && (
            <Button asChild size="sm">
              <Link href="/assets/new">
                <Plus className="h-4 w-4" />
                Subir asset
              </Link>
            </Button>
          )
        }
      />

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay assets. Sube el primer logo o recurso visual de la empresa.
          </p>
          {user.role !== "viewer" && (
            <Button asChild size="sm">
              <Link href="/assets/new">Subir primer asset</Link>
            </Button>
          )}
        </div>
      ) : (
        <AssetsGrid assets={data as BrandAsset[]} isAdmin={isAdmin} />
      )}
    </div>
  );
}
