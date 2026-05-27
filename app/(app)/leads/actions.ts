"use server";

import { requireRole, requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email/resend";
import { appendSignature, renderTemplate } from "@/lib/email/templates";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// ---------------- CREATE ----------------

const CreateInput = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160),
  email: z
    .string()
    .email("Email no válido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z.string().max(40).optional(),
  company: z.string().max(160).optional(),
  source: z.string().max(80).optional(),
  notes: z.string().max(4000).optional(),
});

export async function createLead(formData: FormData): Promise<void> {
  await requireUser();
  const raw = {
    name: formData.get("name")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    company: formData.get("company")?.toString() ?? "",
    source: formData.get("source")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  };
  const parsed = CreateInput.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      source: parsed.data.source || null,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el lead");
  }

  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

// ---------------- UPDATE ----------------

const UpdateInput = CreateInput.extend({
  id: z.string().uuid(),
  estimated_value: z
    .string()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().min(0).max(99_999_999.99).nullable())
    .optional(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export type UpdateLeadInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  notes: string;
  estimated_value: string;
};

export async function updateLead(input: UpdateLeadInput): Promise<ActionResult> {
  await requireRole(["owner", "admin", "member"]);
  const parsed = UpdateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("leads")
    .update({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      source: parsed.data.source || null,
      notes: parsed.data.notes || null,
      estimated_value: parsed.data.estimated_value ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${parsed.data.id}`);
  revalidatePath("/leads");
  return { ok: true };
}

// ---------------- CONVERT TO CLIENT ----------------

const ConvertInput = z.object({
  leadId: z.string().uuid(),
  name: z.string().min(1, "El nombre es obligatorio").max(160),
  nif: z.string().min(1, "El NIF es obligatorio").max(20),
  billing_address: z.string().min(1, "La dirección es obligatoria").max(400),
  email: z
    .string()
    .email("Email no válido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z.string().max(40).optional(),
  contact_person: z.string().max(160).optional(),
  notes: z.string().max(4000).optional(),
});

export type ConvertLeadResult =
  | { ok: true; clientId: string }
  | { ok: false; error: string };

/**
 * Converts a lead into a billable client. Creates the `clients` row with
 * fiscal data, links it via `clients.lead_id`, and marks the lead as `won`.
 * Idempotent: if the lead already has a linked client, returns it.
 */
export async function convertLeadToClient(input: unknown): Promise<ConvertLeadResult> {
  await requireUser();
  const parsed = ConvertInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const data = parsed.data;

  const supabase = await createServerClient();

  // Idempotency: if a client is already linked to this lead, return it.
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("lead_id", data.leadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing?.id) {
    return { ok: true, clientId: existing.id as string };
  }

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      lead_id: data.leadId,
      name: data.name,
      nif: data.nif,
      billing_address: data.billing_address,
      email: data.email ?? null,
      phone: data.phone || null,
      contact_person: data.contact_person || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (error || !client) {
    return { ok: false, error: error?.message ?? "No se pudo crear el cliente" };
  }

  await supabase
    .from("leads")
    .update({ status: "won", updated_at: new Date().toISOString() })
    .eq("id", data.leadId);

  await supabase.from("lead_interactions").insert({
    lead_id: data.leadId,
    client_id: client.id as string,
    type: "note",
    subject: "Convertido a cliente",
  });

  revalidatePath(`/leads/${data.leadId}`);
  revalidatePath("/leads");
  revalidatePath("/clients");
  return { ok: true, clientId: client.id as string };
}

/**
 * Thin FormData wrapper around `convertLeadToClient` for use with
 * `<form action={...}>`. Throws on validation/DB error so Next.js
 * surfaces it; on success, redirects to the new client.
 */
export async function convertLeadToClientForm(formData: FormData): Promise<void> {
  const result = await convertLeadToClient({
    leadId: formData.get("leadId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    nif: formData.get("nif")?.toString() ?? "",
    billing_address: formData.get("billing_address")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    contact_person: formData.get("contact_person")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  });
  if (!result.ok) throw new Error(result.error);
  redirect(`/clients/${result.clientId}`);
}

// ---------------- UPDATE STATUS ----------------

const CLOSURE_STATUSES = ["lost", "not_interested"] as const;
type ClosureStatus = (typeof CLOSURE_STATUSES)[number];
const isClosureStatus = (s: string): s is ClosureStatus =>
  (CLOSURE_STATUSES as readonly string[]).includes(s);

const StatusInput = z
  .object({
    leadId: z.string().uuid(),
    status: z.enum(["new", "qualifying", "quoted", "won", "lost", "not_interested", "archived"]),
    lostReason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((v) => isClosureStatus(v.status) || !v.lostReason, {
    message: "El motivo solo aplica a estados de cierre",
    path: ["lostReason"],
  })
  .refine((v) => !isClosureStatus(v.status) || !!v.lostReason, {
    message: "Indica un motivo de cierre",
    path: ["lostReason"],
  });

export async function updateLeadStatus(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const parsed = StatusInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Estado no válido" };
  }
  const supabase = await createServerClient();
  const updates: Record<string, unknown> = { status: parsed.data.status };
  if (isClosureStatus(parsed.data.status)) {
    updates.lost_reason = parsed.data.lostReason;
    updates.lost_at = new Date().toISOString();
  } else {
    updates.lost_reason = null;
    updates.lost_at = null;
  }
  const { error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", parsed.data.leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${parsed.data.leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

// ---------------- UPDATE ESTIMATED VALUE ----------------

const EstimatedValueInput = z.object({
  leadId: z.string().uuid(),
  value: z.number().min(0).max(99_999_999.99).nullable(),
});

export async function updateLeadEstimatedValue(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const parsed = EstimatedValueInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Valor no válido" };
  }
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("leads")
    .update({ estimated_value: parsed.data.value })
    .eq("id", parsed.data.leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/leads/${parsed.data.leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

// ---------------- EMAIL ----------------

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

// ---------------- LOG INTERACTIONS (call / email / note) ----------------
//
// Acciones ligeras para que el usuario registre cualquier interacción
// con un lead desde la ficha. Todas escriben en lead_interactions y
// devuelven la misma forma `{ ok }` para que el cliente no tenga que
// distinguir entre tipos. La grabación efectiva de envío de email vive
// en `sendEmailToLead`; estas funciones son sólo de registro manual.

export type LogInteractionResult = { ok: true } | { ok: false; error: string };

const CALL_OUTCOMES = ["connected", "voicemail", "no_answer", "busy", "wrong_number"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  connected: "Contactado",
  voicemail: "Buzón de voz",
  no_answer: "Sin respuesta",
  busy: "Comunicando",
  wrong_number: "Número erróneo",
};

const LogCallInput = z
  .object({
    leadId: z.string().uuid(),
    notes: z.string().max(8000).optional(),
    transcript: z.string().max(50000).optional(),
    durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
    outcome: z.enum(CALL_OUTCOMES).optional(),
  })
  .refine((v) => (v.notes?.trim().length ?? 0) > 0 || (v.transcript?.trim().length ?? 0) > 0, {
    message: "Añade unas notas o la transcripción de la llamada",
    path: ["notes"],
  });

export async function logLeadCall(input: unknown): Promise<LogInteractionResult> {
  const user = await requireUser();
  const parsed = LogCallInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const { leadId, notes, transcript, durationMinutes, outcome } = parsed.data;

  const supabase = await createServerClient();
  const { error } = await supabase.from("lead_interactions").insert({
    lead_id: leadId,
    type: "call",
    subject: outcome ? `Llamada · ${CALL_OUTCOME_LABEL[outcome]}` : "Llamada",
    body: notes?.trim() || null,
    performed_by: user.id,
    payload: {
      transcript: transcript?.trim() || null,
      duration_minutes: durationMinutes ?? null,
      outcome: outcome ?? null,
    },
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

const LogEmailInput = z.object({
  leadId: z.string().uuid(),
  direction: z.enum(["incoming", "outgoing"]),
  subject: z.string().min(1, "El asunto es obligatorio").max(300),
  bodyHtml: z.string().max(50000).optional(),
  counterparty: z
    .string()
    .email("Email no válido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function logLeadEmail(input: unknown): Promise<LogInteractionResult> {
  const user = await requireUser();
  const parsed = LogEmailInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const { leadId, direction, subject, bodyHtml, counterparty } = parsed.data;

  const supabase = await createServerClient();
  const { error } = await supabase.from("lead_interactions").insert({
    lead_id: leadId,
    type: direction === "incoming" ? "email_received" : "email_sent",
    subject,
    body: bodyHtml?.trim() || null,
    performed_by: user.id,
    payload: { manual: true, direction, counterparty: counterparty ?? null },
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

const LogNoteInput = z.object({
  leadId: z.string().uuid(),
  content: z.string().min(1, "La nota no puede estar vacía").max(8000),
});

export async function logLeadNote(input: unknown): Promise<LogInteractionResult> {
  const user = await requireUser();
  const parsed = LogNoteInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  const { leadId, content } = parsed.data;

  const supabase = await createServerClient();
  const { error } = await supabase.from("lead_interactions").insert({
    lead_id: leadId,
    type: "note",
    body: content.trim(),
    performed_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}
