import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { telegramRequest } from "@/lib/integrations/telegram";
import { scopedLogger } from "@/lib/logger";
import type { LeadStatusType } from "@/lib/schemas/lead";
import { createAdminClient } from "@/lib/supabase/admin";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("telegram-webhook");

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Compact codes sent from the inline keyboard callback_data
const ACTION_TO_STATUS: Record<string, LeadStatusType> = {
  c: "qualifying", // Contactado
  w: "won", // Ganado
  n: "not_interested", // No interesa
};

const STATUS_LABEL: Record<LeadStatusType, string> = {
  new: "Nuevo",
  qualifying: "Contactado",
  quoted: "Presupuestado",
  won: "Ganado",
  lost: "Perdido",
  not_interested: "No interesa",
  archived: "Archivado",
};

const CLOSURE_STATUSES = new Set<LeadStatusType>(["lost", "not_interested"]);

async function tg(token: string, method: string, body: Record<string, unknown>) {
  return telegramRequest(method, body, { token });
}

/**
 * POST /api/integrations/telegram/webhook
 *
 * Receives Telegram updates routed via setWebhook.
 * Only callback_query updates (inline button taps) are processed — all other
 * update types are silently acknowledged.
 *
 * Security: Telegram sends the secret set in setWebhook as
 * `X-Telegram-Bot-Api-Secret-Token`. We reject anything that doesn't match.
 */
export async function POST(request: NextRequest) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret } = serverEnv();

  if (!token || !secret) {
    log.warn("TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET not configured");
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let update: Record<string, unknown>;
  try {
    update = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Ignore non-callback updates (messages, edits, etc.) — always 200 so
  // Telegram doesn't retry.
  const cq = update.callback_query as Record<string, unknown> | undefined;
  if (!cq) return NextResponse.json({ ok: true });

  const callbackQueryId = String(cq.id ?? "");
  const callbackData = String(cq.data ?? "");
  const msg = (cq.message ?? {}) as Record<string, unknown>;
  const chatId = (msg.chat as { id?: number } | undefined)?.id;
  const messageId = msg.message_id as number | undefined;
  const originalText = String(msg.text ?? "");

  // callback_data format: "code:leadId" (e.g. "c:abc-123")
  const sep = callbackData.indexOf(":");
  const code = sep === -1 ? callbackData : callbackData.slice(0, sep);
  const leadId = sep === -1 ? "" : callbackData.slice(sep + 1);

  const nextStatus = ACTION_TO_STATUS[code];
  if (!nextStatus || !leadId) {
    await tg(token, "answerCallbackQuery", { callback_query_id: callbackQueryId });
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  const { data: current, error: readErr } = await supabase
    .from("leads")
    .select("name, status")
    .eq("id", leadId)
    .is("deleted_at", null)
    .single();

  if (readErr || !current) {
    log.warn({ leadId, err: readErr }, "lead not found");
    await tg(token, "answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text: "⚠️ Lead no encontrado",
      show_alert: true,
    });
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const fromStatus = current.status as LeadStatusType;
  const leadName = current.name as string;
  const label = STATUS_LABEL[nextStatus];

  if (fromStatus !== nextStatus) {
    const isClosure = CLOSURE_STATUSES.has(nextStatus);
    await supabase
      .from("leads")
      .update({
        status: nextStatus,
        lost_reason: isClosure ? "Marcado desde Telegram" : null,
        lost_at: isClosure ? new Date().toISOString() : null,
      })
      .eq("id", leadId);

    await supabase.from("lead_interactions").insert({
      lead_id: leadId,
      type: "status_change",
      subject: `Estado: ${fromStatus} → ${nextStatus}`,
      body: "Vía Telegram",
      payload: { from: fromStatus, to: nextStatus, source: "telegram_webhook" },
    });

    log.info({ leadId, leadName, from: fromStatus, to: nextStatus }, "status updated via Telegram");
  }

  // Dismiss the spinner in Telegram
  await tg(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: `✓ ${label}`,
  });

  // Edit the original notification message to show the new status
  if (chatId && messageId) {
    await tg(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: `${originalText}\n\n———\n📌 *Estado:* ${label} _(vía Telegram)_`,
      parse_mode: "Markdown",
    });
  }

  return NextResponse.json({ ok: true });
}
