/**
 * GET /api/crm/follow-ups
 *
 * Cron endpoint consumed by n8n / Vercel Cron. Returns stale leads, pending
 * proposals, and speed-to-lead SLA breaches. Also fires Telegram alerts for
 * uncontacted leads so the team is notified without logging into the backoffice.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * (No-op when CRON_SECRET is not set — allows local dev without config.)
 */

import { serverEnv } from "@/lib/env";
import { getFollowUps } from "@/lib/integrations/follow-ups";
import { telegramSendMessage } from "@/lib/integrations/telegram";
import { scopedLogger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("crm.follow-ups");

function authenticate(request: NextRequest): boolean {
  const { CRON_SECRET } = serverEnv();
  if (!CRON_SECRET) return true; // open in dev when not configured

  const auth = request.headers.get("authorization") ?? "";
  // Support both "Bearer <secret>" and bare "<secret>"
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return token === CRON_SECRET;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const slaHours = Number(url.searchParams.get("sla_hours") ?? "4");
  const leadHours = Number(url.searchParams.get("lead_hours") ?? "24");
  const proposalHours = Number(url.searchParams.get("proposal_hours") ?? "72");

  const data = await getFollowUps({ slaHours, leadHours, proposalHours });

  // ── Telegram SLA alert ──────────────────────────────────────────────────────
  if (data.uncontactedLeads.length > 0) {
    const lines = [
      `⚠️ *${data.uncontactedLeads.length} lead${data.uncontactedLeads.length > 1 ? "s" : ""} sin contacto (>${slaHours}h)*`,
      "",
      ...data.uncontactedLeads.map(
        (l) =>
          `• [${l.name}](${l.url})${l.company ? ` · ${l.company}` : ""} · *${l.hoursUncontacted}h*`,
      ),
    ].join("\n");

    const tgResult = await telegramSendMessage({ text: lines, parseMode: "Markdown" }).catch(
      (e) => ({ ok: false, error: String(e) }),
    );

    if (!tgResult.ok) {
      log.warn({ error: tgResult.error }, "telegram sla alert failed");
    } else {
      log.info({ count: data.uncontactedLeads.length }, "sla telegram alert sent");
    }
  }

  log.info(
    {
      uncontacted: data.counts.uncontactedLeads,
      stale: data.counts.staleLeads,
      proposals: data.counts.pendingProposals,
    },
    "follow-ups cron executed",
  );

  return NextResponse.json(data);
}
