"use server";

import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email/resend";
import { appendSignature, renderTemplate } from "@/lib/email/templates";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const Input = z.object({
  leadId: z.string().uuid(),
  templateSlug: z.string().min(1).optional(),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  includeSignature: z.boolean().default(true),
  to: z.string().email(),
});

export type SendEmailToLeadResult =
  | { ok: true; emailId: string | null; mocked: boolean }
  | { ok: false; error: string };

export async function sendEmailToLead(input: unknown): Promise<SendEmailToLeadResult> {
  const user = await requireUser();
  if (!user.emailSendEnabled) {
    return { ok: false, error: "Tu cuenta no tiene activado el envío de emails." };
  }
  if (!user.emailAlias) {
    return { ok: false, error: "No tienes un alias configurado en tu perfil." };
  }

  const parsed = Input.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const supabase = await createServerClient();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, name, email, company")
    .eq("id", data.leadId)
    .is("deleted_at", null)
    .single();
  if (leadErr || !lead) return { ok: false, error: leadErr?.message ?? "Lead no encontrado" };

  const rendered = renderTemplate(data.bodyHtml, {
    nombre: lead.name as string,
    empresa: (lead.company as string | null) ?? "",
    email: (lead.email as string | null) ?? "",
    sender_name: user.name,
  });
  const finalHtml = data.includeSignature
    ? appendSignature(rendered, user.signatureHtml)
    : rendered;

  let resendId: string | null = null;
  let mocked = false;
  try {
    const sent = await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias,
      to: data.to,
      replyTo: user.email,
      subject: renderTemplate(data.subject, {
        nombre: lead.name as string,
        empresa: (lead.company as string | null) ?? "",
      }),
      html: finalHtml,
      tags: { lead_id: data.leadId },
    });
    resendId = sent.id;
    mocked = sent.mocked;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error enviando email" };
  }

  await supabase.from("lead_interactions").insert({
    lead_id: data.leadId,
    type: "email_sent",
    subject: data.subject,
    body: finalHtml,
    resend_email_id: resendId,
    performed_by: user.id,
    payload: { template_slug: data.templateSlug ?? null, mocked },
  });

  revalidatePath(`/leads/${data.leadId}`);
  return { ok: true, emailId: resendId, mocked };
}
