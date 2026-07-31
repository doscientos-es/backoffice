import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { sendWebPushToMembers } from "@/lib/push/web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("team_members")
    .select("id, role")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!member || !["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const env = serverEnv();
  if (!env.WEB_PUSH_VAPID_PUBLIC_KEY || !env.WEB_PUSH_VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Web Push no está configurado en producción" },
      { status: 503 },
    );
  }
  const { count } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("member_id", user.id);
  if (!count) {
    return NextResponse.json({ error: "Este dispositivo aún no está suscrito" }, { status: 409 });
  }

  await sendWebPushToMembers([user.id], {
    title: "✅ Push de prueba",
    body: "Las notificaciones de nuevos leads están activas en este móvil.",
    url: "/settings/diagnostics",
    tag: "diagnostic-push",
    badge: 1,
  });
  return NextResponse.json({ ok: true, detail: "Push enviado a tus dispositivos registrados" });
}
