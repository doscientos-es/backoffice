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

/** Maximum age (seconds) accepted for a Svix timestamp to prevent replay attacks. */
const SVIX_TIMESTAMP_TOLERANCE_S = 300;

/**
 * Verifies a Resend webhook using the Svix signing scheme.
 *
 * Message = `${svix-id}.${svix-timestamp}.${rawBody}`
 * Secret  = base64-decoded `whsec_…` value from Resend dashboard.
 * Header  = `svix-signature: v1,<base64> [v1,<base64> …]`
 */
function verifySvixSignature(
  secret: string,
  body: string,
  msgId: string | null,
  msgTimestamp: string | null,
  sigHeader: string | null,
): boolean {
  if (!msgId || !msgTimestamp || !sigHeader) return false;

  // Replay protection: reject messages older than tolerance window.
  const ts = Number(msgTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SVIX_TIMESTAMP_TOLERANCE_S) {
    return false;
  }

  // Decode the whsec_<base64> secret used by Resend.
  const rawKey = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");

  const toSign = `${msgId}.${msgTimestamp}.${body}`;
  const expected = createHmac("sha256", rawKey).update(toSign).digest("base64");

  // The header may carry multiple space-separated `v1,<base64>` signatures.
  return sigHeader
    .split(" ")
    .filter((s) => s.startsWith("v1,"))
    .some((sig) => {
      const a = Buffer.from(expected, "base64");
      const b = Buffer.from(sig.slice(3), "base64");
      return a.length === b.length && timingSafeEqual(a, b);
    });
}

export async function POST(request: NextRequest) {
  const env = serverEnv();
  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const raw = await request.text();
  if (
    !verifySvixSignature(
      env.RESEND_WEBHOOK_SECRET,
      raw,
      request.headers.get("svix-id"),
      request.headers.get("svix-timestamp"),
      request.headers.get("svix-signature"),
    )
  ) {
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
