import { z } from "zod";
import { assignableUuid, optionalEmail, optionalText, requiredText } from "./common";

/**
 * Zod schemas for the `leads` domain.
 */

export const LeadStatus = z.enum([
  "new",
  "qualifying",
  "quoted",
  "won",
  "lost",
  "not_interested",
  "archived",
]);

export type LeadStatusType = z.infer<typeof LeadStatus>;

export const CreateLeadInput = z.object({
  name: requiredText(160, "El nombre es obligatorio"),
  email: optionalEmail,
  phone: optionalText(40),
  company: optionalText(160),
  source: optionalText(80),
  notes: optionalText(4000),
  estimated_value: z.number().min(0).max(99_999_999.99).nullable().optional(),
  assigned_to: assignableUuid.optional(),
});

export type CreateLeadInputType = z.infer<typeof CreateLeadInput>;

export const UpdateLeadInput = CreateLeadInput.extend({
  id: z.string().uuid(),
  estimated_value: z.number().min(0).max(99_999_999.99).nullable().optional(),
});

export type UpdateLeadInputType = z.infer<typeof UpdateLeadInput>;

export const ConvertLeadInput = z.object({
  leadId: z.string().uuid(),
  name: requiredText(160, "El nombre es obligatorio"),
  nif: requiredText(20, "El NIF es obligatorio"),
  billing_address: requiredText(400, "La dirección es obligatoria"),
  email: optionalEmail,
  phone: optionalText(40),
  contact_person: optionalText(160),
  notes: optionalText(4000),
});

export type ConvertLeadInputType = z.infer<typeof ConvertLeadInput>;

export const UpdateLeadStatusInput = z
  .object({
    leadId: z.string().uuid(),
    status: LeadStatus,
    lostReason: optionalText(500),
  })
  .refine(
    (v) => {
      const isClosure = v.status === "lost" || v.status === "not_interested";
      return isClosure || !v.lostReason;
    },
    {
      message: "El motivo solo aplica a estados de cierre",
      path: ["lostReason"],
    },
  )
  .refine(
    (v) => {
      const isClosure = v.status === "lost" || v.status === "not_interested";
      return !isClosure || !!v.lostReason;
    },
    {
      message: "Indica un motivo de cierre",
      path: ["lostReason"],
    },
  );

export type UpdateLeadStatusInputType = z.infer<typeof UpdateLeadStatusInput>;

export const CALL_OUTCOMES = [
  "connected",
  "voicemail",
  "no_answer",
  "busy",
  "wrong_number",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const LogCallInput = z
  .object({
    leadId: z.string().uuid(),
    notes: optionalText(8000),
    transcript: optionalText(50000),
    durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
    outcome: z.enum(CALL_OUTCOMES).optional(),
  })
  .refine((v) => (v.notes?.trim().length ?? 0) > 0 || (v.transcript?.trim().length ?? 0) > 0, {
    message: "Añade unas notas o la transcripción de la llamada",
    path: ["notes"],
  });

export type LogCallInputType = z.infer<typeof LogCallInput>;

export const LogEmailInput = z.object({
  leadId: z.string().uuid(),
  direction: z.enum(["incoming", "outgoing"]),
  subject: requiredText(300, "El asunto es obligatorio"),
  bodyHtml: optionalText(50000),
  counterparty: optionalEmail,
});

export type LogEmailInputType = z.infer<typeof LogEmailInput>;

export const LogNoteInput = z.object({
  leadId: z.string().uuid(),
  content: requiredText(8000, "La nota no puede estar vacía"),
});

export type LogNoteInputType = z.infer<typeof LogNoteInput>;

export const SendEmailToLeadInput = z.object({
  leadId: z.string().uuid(),
  templateSlug: z.string().min(1).optional(),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  includeSignature: z.boolean().default(true),
  to: z.string().email(),
});

export type SendEmailToLeadInputType = z.infer<typeof SendEmailToLeadInput>;

export const AssignLeadOwnerInput = z.object({
  leadId: z.string().uuid(),
  assigneeId: assignableUuid,
});

export type AssignLeadOwnerInputType = z.infer<typeof AssignLeadOwnerInput>;
