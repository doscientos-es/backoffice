"use server";

import { AI_MODELS, isAIEnabled, runAIChat } from "@/lib/ai";
import { requireRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email/resend";
import { telegramGetMe, telegramSendMessage } from "@/lib/integrations/telegram";
import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type TestResult = { ok: true; detail: string } | { ok: false; error: string };

const log = scopedLogger("diagnostics");
const ADMIN = ["owner", "admin"] as const;

function fail(error: string): TestResult {
  return { ok: false, error };
}

/** Verifies the bot token is valid (read-only, no chat needed). */
export async function testTelegramBot(): Promise<TestResult> {
  await requireRole([...ADMIN]);
  const res = await telegramGetMe();
  if (!res.ok) return fail(res.error);
  const username = res.result.username
    ? `@${res.result.username}`
    : (res.result.first_name ?? "bot");
  return { ok: true, detail: `Bot conectado: ${username}` };
}

/** Sends a mock "new lead" message directly to the configured Telegram chat. */
export async function testTelegramLeadMessage(): Promise<TestResult> {
  await requireRole([...ADMIN]);
  const text = [
    "🔔 *Lead de prueba (diagnóstico)*",
    "",
    "👤 Lead de prueba",
    "📧 test@doscientos.es",
    "📱 600 000 000",
    "🏢 ACME S.L.",
    "🎯 Fuente: diagnóstico",
    "",
    "_Mensaje de prueba enviado desde Ajustes → Diagnóstico._",
  ].join("\n");

  const res = await telegramSendMessage({ text, parseMode: "Markdown" });
  if (!res.ok) return fail(res.error);
  return { ok: true, detail: "Mensaje enviado al chat de Telegram" };
}

/** Sends a test email to the current admin via Resend. */
export async function testResendEmail(): Promise<TestResult> {
  const user = await requireRole([...ADMIN]);
  try {
    const result = await sendEmail({
      fromName: "doscientos",
      fromAlias: "notificaciones",
      to: user.email,
      subject: "Prueba de diagnóstico · doscientos",
      html: "<p>Este es un email de prueba enviado desde Ajustes → Diagnóstico.</p>",
      tags: { type: "diagnostic" },
    });
    if (result.mocked) {
      return { ok: true, detail: "Resend en modo mock (sin RESEND_API_KEY)" };
    }
    return { ok: true, detail: `Email enviado a ${user.email}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error al enviar";
    log.error({ err: e }, "resend test failed");
    return fail(msg);
  }
}

/** Runs a lightweight query against Supabase using the admin client. */
export async function testSupabaseConnection(): Promise<TestResult> {
  await requireRole([...ADMIN]);
  try {
    const supabase = createAdminClient();
    const started = Date.now();
    const { error, count } = await supabase
      .from("settings")
      .select("id", { count: "exact", head: true });
    if (error) return fail(error.message);
    return { ok: true, detail: `Conexión OK · ${count ?? 0} fila(s) · ${Date.now() - started} ms` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error de conexión";
    log.error({ err: e }, "supabase test failed");
    return fail(msg);
  }
}

/** Pings the AI provider with a tiny prompt. */
export async function testAI(): Promise<TestResult> {
  await requireRole([...ADMIN]);
  if (!isAIEnabled()) return fail("IA no configurada (GEMINI_API_KEY / OPENAI_API_KEY)");
  try {
    const out = await runAIChat({
      model: AI_MODELS.default,
      system: "Responde con una sola palabra.",
      user: "Di 'ok'.",
      temperature: 0,
    });
    return { ok: true, detail: `IA respondió: ${out.slice(0, 40)}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error de IA";
    log.error({ err: e }, "ai test failed");
    return fail(msg);
  }
}
