import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { BrandAsset } from "./_components/assets-grid";
import { BrandHub } from "./_components/brand-hub";
import type { BrandToken } from "./_components/token-edit-dialog";

export const metadata: Metadata = { title: "Marca · doscientos" };
export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const user = await requireUser();
  const supabase = await createServerClient();

  const [assetsResult, tokensResult] = await Promise.all([
    supabase
      .from("brand_assets")
      .select("id, name, description, category, mime_type, size_bytes, public_url, created_at")
      .is("deleted_at", null)
      .order("category")
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_tokens")
      .select("id, token_group, key, value, value_dark, description, sort_order")
      .order("token_group")
      .order("sort_order"),
  ]);

  const isAdmin = user.role === "owner" || user.role === "admin";

  return (
    <div className="flex flex-col h-full gap-6">
      <PageHeader
        title="Marca"
        description="Assets visuales, tokens de diseño y exportación para nuevos proyectos."
        className="shrink-0"
        actions={
          user.role !== "viewer" ? (
            <Button asChild size="sm">
              <Link href="/brand/new">
                <Plus className="size-3.5" />
                Subir asset
              </Link>
            </Button>
          ) : undefined
        }
      />

      {assetsResult.error || tokensResult.error ? (
        <p className="text-sm text-destructive">
          {assetsResult.error?.message ?? tokensResult.error?.message}
        </p>
      ) : (
        <BrandHub
          assets={(assetsResult.data ?? []) as BrandAsset[]}
          tokens={(tokensResult.data ?? []) as BrandToken[]}
          isAdmin={isAdmin}
          className="flex-1 min-h-0"
        />
      )}
    </div>
  );
}
