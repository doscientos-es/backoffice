import { LeadConfirmationEmail } from "@/components/email/lead-confirmation-email";
import { NewLeadEmail } from "@/components/email/new-lead-email";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { publicEnv } from "@/lib/env";
import { telegramSendMessage } from "@/lib/integrations/telegram";
import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotifyNewLeadInput = {
  leadId: string;
  leadName: string;
  leadEmail?: string | null;
  leadPhone?: string | null;
  leadCompany?: string | null;
  leadSource: string;
  leadNotes?: string | null;
  /** Qualification signals surfaced at the top of the Telegram alert. */
  leadEstimatedValue?: number | null;
  leadCompanySize?: string | null;
  leadUrgency?: string | null;
};

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const log = scopedLogger("notify-new-lead");

/**
 * Notifies all active owners and admins when a new lead is created.
 *
 * - Inserts an in-app `notifications` row (event_type: "lead_new") for each recipient
 *   so the bell icon lights up in real-time via Supabase Realtime.
 * - Sends a transactional email via Resend.
 *
 * Errors inside this function are logged but never propagate — callers should
 * invoke with `.catch(() => {})` so lead creation is never blocked.
 */
export async function notifyNewLead(input: NotifyNewLeadInput): Promise<void> {
  const supabase = createAdminClient();
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  const leadUrl = `${appUrl}/leads/${input.leadId}`;

  // ── 1. Fetch active owners and admins ────────────────────────────────────
  const { data: recipients, error: fetchError } = await supabase
    .from("team_members")
    .select("id, name, email")
    .in("role", ["owner", "admin"])
    .is("deleted_at", null);

  if (fetchError) {
    log.error({ err: fetchError }, "failed to fetch admin/owner recipients");
    return;
  }
  if (!recipients?.length) {
    log.warn("no admin/owner recipients to notify for lead_new");
    return;
  }

  // Short summary line used as the in-app notification body
  const notifBody = [input.leadName, input.leadCompany, input.leadEmail, input.leadPhone]
    .filter(Boolean)
    .join(" · ");

  // ── 2. In-app notifications (bulk insert) ────────────────────────────────
  const { error: notifError } = await supabase.from("notifications").insert(
    recipients.map((r) => ({
      recipient_id: r.id as string,
      actor_id: null,
      event_type: "lead_new",
      entity_type: "lead",
      entity_id: input.leadId,
      body: notifBody,
      link: `/leads/${input.leadId}`,
    })),
  );

  if (notifError) {
    log.error({ err: notifError }, "failed to insert lead_new notifications");
    // Continue — email delivery is independent
  }

  // ── 3. Email (render once, send to all) ──────────────────────────────────
  let html: string;
  try {
    html = await renderEmail(
      NewLeadEmail({
        leadName: input.leadName,
        leadEmail: input.leadEmail ?? null,
        leadPhone: input.leadPhone ?? null,
        leadCompany: input.leadCompany ?? null,
        leadSource: input.leadSource,
        leadUrl,
        appUrl,
      }),
    );
  } catch (e) {
    log.error({ err: e }, "failed to render NewLeadEmail");
    return;
  }

  const subject = `Nuevo lead: ${input.leadName}${input.leadCompany ? ` · ${input.leadCompany}` : ""}`;

  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendEmail({
        fromName: "doscientos",
        fromAlias: "notificaciones",
        to: r.email as string,
        subject,
        html,
        tags: { lead_id: input.leadId },
      }),
    ),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    log.error({ leadId: input.leadId, failed }, "some lead_new emails failed to send");
  }

  log.info(
    { leadId: input.leadId, recipientCount: recipients.length, emailsFailed: failed },
    "lead_new notifications dispatched",
  );

  // ── 4. Telegram direct notification ─────────────────────────────────────
  // Qualification block: budget, firmographics and intent up top so the sales
  // team can triage the lead at a glance without opening the backoffice.
  const qualLines = [
    input.leadEstimatedValue != null
      ? `💰 Valor estimado: ${eur.format(input.leadEstimatedValue)}`
      : null,
    input.leadCompanySize ? `👥 Tamaño: ${input.leadCompanySize}` : null,
    input.leadUrgency ? `⏱️ Urgencia: ${input.leadUrgency}` : null,
  ].filter((l): l is string => l !== null);

  const notesLines = input.leadNotes
    ? ["", "📋 *Formulario*", ...input.leadNotes.split("\n").map((l) => `  ${l}`)]
    : [];

  const lines = [
    "🔔 *Nuevo lead*",
    "",
    `👤 ${input.leadName}`,
    input.leadEmail ? `📧 ${input.leadEmail}` : null,
    input.leadPhone ? `📱 ${input.leadPhone}` : null,
    input.leadCompany ? `🏢 ${input.leadCompany}` : null,
    `🎯 Fuente: ${input.leadSource}`,
    ...qualLines,
    ...notesLines,
    "",
    `🔗 [Ver en backoffice](${leadUrl})`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const tgRes = await telegramSendMessage({
    text: lines,
    parseMode: "Markdown",
    inlineKeyboard: [
      [
        { text: "✅ Contactado", callback_data: `c:${input.leadId}` },
        { text: "🏆 Ganado", callback_data: `w:${input.leadId}` },
        { text: "❌ No interesa", callback_data: `n:${input.leadId}` },
      ],
    ],
  });

  if (tgRes.ok) {
    log.info({ leadId: input.leadId }, "telegram lead notification sent");
  } else {
    log.error({ leadId: input.leadId, err: tgRes.error }, "telegram lead notification failed");
  }

  // ── 5. Confirmation email to the lead ────────────────────────────────────
  if (input.leadEmail) {
    try {
      const confirmHtml = await renderEmail(
        LeadConfirmationEmail({ leadName: input.leadName, appUrl }),
      );
      await sendEmail({
        fromName: "doscientos",
        fromAlias: "hola",
        to: input.leadEmail,
        subject: "Hemos recibido tu solicitud ✓",
        html: confirmHtml,
        tags: { lead_id: input.leadId, type: "lead_confirmation" },
      });
      log.info({ leadId: input.leadId }, "lead confirmation email sent");
    } catch (e) {
      log.error({ err: e, leadId: input.leadId }, "failed to send lead confirmation email");
    }
  }
}
