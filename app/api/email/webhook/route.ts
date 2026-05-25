import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { type NextRequest, NextResponse } from "next/server";

const RESEND_TO_INTERACTION: Record<string, string> = {
  "email.delivered": "email_delivered",
  "email.opened": "email_opened",
  "email.clicked": "email_clicked",
  "email.bounced": "email_bounced",
  "email.complained": "email_complained",
};

function verifySignature(secret: string, body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.replace(/^sha256=/, ""));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const env = serverEnv();
  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const raw = await request.text();
  const signature =
    request.headers.get("resend-signature") ?? request.headers.get("svix-signature");
  if (!verifySignature(env.RESEND_WEBHOOK_SECRET, raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { type?: string; data?: { email_id?: string; to?: string | string[] } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = payload.type;
  const emailId = payload.data?.email_id;
  if (!type || !emailId) return NextResponse.json({ ok: true });

  const interactionType = RESEND_TO_INTERACTION[type];
  if (!interactionType) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();
  const { data: prior } = await supabase
    .from("lead_interactions")
    .select("lead_id, client_id")
    .eq("resend_email_id", emailId)
    .limit(1)
    .maybeSingle();

  await supabase.from("lead_interactions").insert({
    lead_id: prior?.lead_id ?? null,
    client_id: prior?.client_id ?? null,
    type: interactionType,
    resend_email_id: emailId,
    payload: payload.data as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}
