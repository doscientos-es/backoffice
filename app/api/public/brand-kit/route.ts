import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Public, cacheable feed consumed while building the marketing site's brand portal.
 * The admin client is intentional: public callers only ever receive published guides.
 */
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_guides")
    .select("slug, title, description, content, sort_order, published_at")
    .eq("status", "published")
    .order("sort_order")
    .order("published_at", { ascending: false });

  if (error) return NextResponse.json({ error: "brand_kit_unavailable" }, { status: 503 });

  return NextResponse.json(
    { guides: data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } },
  );
}
