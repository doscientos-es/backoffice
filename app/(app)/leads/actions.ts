"use server";

import { defineAction } from "@/lib/actions/define-action";
import { sendEmail } from "@/lib/email/resend";
import { buildSignatureHtml } from "@/lib/email/signature";
import { appendSignature, markdownToHtml, renderTemplate } from "@/lib/email/templates";
import { addEmailTracking } from "@/lib/email/tracking";
import { isGoogleEnabled, publicEnv, serverEnv } from "@/lib/env";
import { findConflicts, insertEvent } from "@/lib/google/calendar";
import type { CalendarBusySlot } from "@/lib/google/calendar";
import { resolveSubject } from "@/lib/google/client";
import { pushMetaConversion } from "@/lib/integrations/meta-capi";
import { normalizeCompanySize, normalizeLeadSource, normalizeUrgency } from "@/lib/leads/constants";
import {
  AssignLeadOwnerInput,
  CheckMeetingSlotInput,
  ConvertLeadInput,
  CreateLeadInput,
  LogCallInput,
  LogEmailInput,
  LogNoteInput,
  type MomTestSignal,
  ScheduleLeadMeetingInput,
  SendEmailToLeadInput,
  UpdateLeadInput,
  UpdateLeadMomTestInput,
  UpdateLeadStatusInput,
} from "@/lib/schemas/lead";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

/**
 * Speed-to-lead: stamps `first_contacted_at` on the first real outbound touch
 * (call, logged email, sent email or booked meeting). The
 * `is("first_contacted_at", null)` guard keeps it idempotent and race-safe —
 * only the first contact wins; later touches are no-ops.
 */
async function markFirstContacted(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  leadId: string,
): Promise<void> {
  await supabase
    .from("leads")
    .update({ first_contacted_at: new Date().toISOString() })
    .eq("id", leadId)
    .is("first_contacted_at", null);
}

// ---------------- CREATE ----------------

export const createLead = defineAction({
  name: "leads.create",
  schema: CreateLeadInput,
  revalidate: () => ["/leads"],
  handler: async (input, { user }) => {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        ...input,
        source: normalizeLeadSource(input.source) ?? null,
        company_size: normalizeCompanySize(input.company_size),
        urgency: normalizeUrgency(input.urgency),
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo crear el lead");
    }

    return { id: data.id as string };
  },
});

// ---------------- DELETE ----------------

export const deleteLead = defineAction({
  name: "leads.delete",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin"],
  revalidate: () => ["/leads"],
  handler: async (input) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  },
});

// ---------------- UPDATE ----------------

export const updateLead = defineAction({
  name: "leads.update",
  schema: UpdateLeadInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => ["/leads", `/leads/${input.id}`],
  handler: async (input, { user }) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("leads")
      .update({
        ...input,
        source: normalizeLeadSource(input.source) ?? null,
        company_size: normalizeCompanySize(input.company_size),
        urgency: normalizeUrgency(input.urgency),
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", input.id);

    if (error) throw new Error(error.message);
  },
});

// ---------------- CONVERT TO CLIENT ----------------

/**
 * Converts a lead into a billable client. Creates the `clients` row with
 * fiscal data, links it via `clients.lead_id`, and marks the lead as `won`.
 * Idempotent: if the lead already has a linked client, returns it.
 */
export const convertLeadToClient = defineAction({
  name: "leads.convert",
  schema: ConvertLeadInput,
  handler: async (data, { user }) => {
    const supabase = await createServerClient();

    // Idempotency: if a client is already linked to this lead, return it.
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("lead_id", data.leadId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing?.id) {
      return { clientId: existing.id as string };
    }

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        lead_id: data.leadId,
        name: data.name,
        label: data.alias || null,
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
      throw new Error(error?.message ?? "No se pudo crear el cliente");
    }

    await supabase
      .from("leads")
      .update({ status: "won", updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", data.leadId);

    await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      client_id: client.id as string,
      type: "note",
      subject: "Convertido a cliente",
      performed_by: user.id,
    });

    revalidatePath(`/leads/${data.leadId}`);
    revalidatePath("/leads");
    revalidatePath("/clients");

    // Fire-and-forget: push conversion to Meta CAPI after response is sent.
    // Uses adminClient to avoid relying on session context inside after().
    const leadId = data.leadId;
    after(async () => {
      try {
        const { data: lead } = await createAdminClient()
          .from("leads")
          .select("email, phone, estimated_value")
          .eq("id", leadId)
          .maybeSingle();
        if (lead) {
          await pushMetaConversion({
            eventName: "Lead",
            eventId: `convert-${leadId}`,
            email: lead.email as string | null,
            phone: lead.phone as string | null,
            value: lead.estimated_value as number | null,
          });
        }
      } catch {
        // CAPI is best-effort — never block the conversion
      }
    });

    return { clientId: client.id as string };
  },
});

/**
 * Thin FormData wrapper around `convertLeadToClient` for use with
 * `<form action={...}>`. Throws on validation/DB error so Next.js
 * surfaces it; on success, redirects to the new client.
 */
export async function convertLeadToClientForm(formData: FormData): Promise<void> {
  const result = await convertLeadToClient(formData);
  if (!result.ok) throw new Error(result.error);
  redirect(`/clients/${result.clientId}`);
}

// ---------------- UPDATE STATUS ----------------

const CLOSURE_STATUSES = ["lost", "not_interested"] as const;
type ClosureStatus = (typeof CLOSURE_STATUSES)[number];
const isClosureStatus = (s: string): s is ClosureStatus =>
  (CLOSURE_STATUSES as readonly string[]).includes(s);

export const updateLeadStatus = defineAction({
  name: "leads.updateStatus",
  schema: UpdateLeadStatusInput,
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const supabase = await createServerClient();

    // Read current status before updating so we can log `from → to`.
    const { data: current } = await supabase
      .from("leads")
      .select("status")
      .eq("id", data.leadId)
      .single();

    const updates: Record<string, unknown> = {
      status: data.status,
      updated_by: user.id,
    };
    if (isClosureStatus(data.status)) {
      updates.lost_reason = data.lostReason;
      updates.lost_at = new Date().toISOString();
    } else {
      updates.lost_reason = null;
      updates.lost_at = null;
    }
    const { error } = await supabase.from("leads").update(updates).eq("id", data.leadId);
    if (error) throw new Error(error.message);

    // Log the transition in the interactions timeline.
    await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      type: "status_change",
      subject: `Estado: ${current?.status ?? "?"} → ${data.status}`,
      performed_by: user.id,
      payload: {
        from: current?.status ?? null,
        to: data.status,
        lost_reason: data.lostReason ?? null,
      },
    });
  },
});

// ---------------- UPDATE ESTIMATED VALUE ----------------

export const updateLeadEstimatedValue = defineAction({
  name: "leads.updateEstimatedValue",
  schema: z.object({
    leadId: z.string().uuid(),
    value: z.number().min(0).max(99_999_999.99).nullable(),
  }),
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("leads")
      .update({ estimated_value: data.value, updated_by: user.id })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
  },
});

// ---------------- UPDATE MOM TEST SIGNAL ----------------

/** Maps a Mom Test signal key to its `leads` table column. */
const MOM_TEST_COLUMN: Record<MomTestSignal, string> = {
  real_problem: "mom_test_real_problem",
  aware_problem: "mom_test_aware_problem",
  tried_solutions: "mom_test_tried_solutions",
  decision_power_or_budget: "mom_test_decision_power_or_budget",
  accessible: "mom_test_accessible",
};

export const updateLeadMomTestSignal = defineAction({
  name: "leads.updateMomTestSignal",
  schema: UpdateLeadMomTestInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const supabase = await createServerClient();
    const column = MOM_TEST_COLUMN[data.signal];
    const { error } = await supabase
      .from("leads")
      .update({ [column]: data.value, updated_by: user.id })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
  },
});

// ---------------- CLAIM (reclamar un lead sin owner) ----------------

/**
 * Assigns an unowned lead to the current member. Guarded by
 * `assigned_to IS NULL` in the UPDATE so two members racing to claim the same
 * lead can't both win — the loser gets a clear error instead of silently
 * overwriting the owner.
 */
export const claimLead = defineAction({
  name: "leads.claim",
  schema: z.object({ leadId: z.string().uuid() }),
  roles: ["owner", "admin", "member"],
  revalidate: () => ["/leads", "/inicio"],
  handler: async (input, { user }) => {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("leads")
      .update({
        assigned_to: user.id,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", input.leadId)
      .is("assigned_to", null)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Este lead ya tiene responsable.");

    await supabase.from("lead_interactions").insert({
      lead_id: input.leadId,
      type: "note",
      subject: `Lead asignado a ${user.name}`,
      performed_by: user.id,
    });

    return { id: data.id as string };
  },
});

// ---------------- EMAIL ----------------

export const sendEmailToLead = defineAction({
  name: "leads.sendEmail",
  schema: SendEmailToLeadInput,
  handler: async (data, { user }) => {
    if (!user.emailAlias) {
      throw new Error("No tienes un alias configurado en tu perfil.");
    }

    const supabase = await createServerClient();

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, name, email, company")
      .eq("id", data.leadId)
      .is("deleted_at", null)
      .single();
    if (leadErr || !lead) throw new Error(leadErr?.message ?? "Lead no encontrado");

    const renderedMarkdown = renderTemplate(data.bodyHtml, {
      nombre: lead.name as string,
      empresa: (lead.company as string | null) ?? "",
      email: (lead.email as string | null) ?? "",
      sender_name: user.name,
    });
    const renderedHtml = markdownToHtml(renderedMarkdown);
    const finalHtml = data.includeSignature
      ? appendSignature(
          renderedHtml,
          buildSignatureHtml(
            {
              name: user.name,
              jobTitle: user.jobTitle ?? undefined,
              phone: user.phone ?? undefined,
              contactEmail: user.contactEmail ?? user.emailAlias ?? undefined,
            },
            publicEnv.NEXT_PUBLIC_APP_URL || "https://app.doscientos.es",
          ),
        )
      : renderedHtml;

    const renderedSubject = renderTemplate(data.subject, {
      nombre: lead.name as string,
      empresa: (lead.company as string | null) ?? "",
    });

    const { data: campaign, error: campaignErr } = await supabase
      .from("lead_campaigns")
      .insert({
        name: `Email individual · ${lead.name as string}`,
        subject: renderedSubject,
        body_html: finalHtml,
        status: "sending",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (campaignErr || !campaign) {
      throw new Error(campaignErr?.message ?? "No se pudo preparar el tracking del email");
    }

    const { data: sendRow, error: sendErr } = await supabase
      .from("lead_campaign_sends")
      .insert({
        campaign_id: campaign.id as string,
        lead_id: data.leadId,
        email: data.to,
      })
      .select("id, tracking_token")
      .single();
    if (sendErr || !sendRow) {
      throw new Error(sendErr?.message ?? "No se pudo preparar el envío trackeado");
    }

    const trackedHtml = addEmailTracking(
      finalHtml,
      publicEnv.NEXT_PUBLIC_APP_URL || "https://app.doscientos.es",
      sendRow.tracking_token as string,
    );

    let resendId: string | null = null;
    let mocked = false;
    try {
      const sent = await sendEmail({
        fromName: user.name,
        fromAlias: user.emailAlias,
        to: data.to,
        replyTo: user.email,
        subject: renderedSubject,
        html: trackedHtml,
        tags: { lead_id: data.leadId, campaign_send_id: sendRow.id as string },
      });
      resendId = sent.id;
      mocked = sent.mocked;
    } catch (e) {
      await supabase.from("lead_campaigns").update({ status: "paused" }).eq("id", campaign.id);
      throw new Error(e instanceof Error ? e.message : "Error enviando email");
    }

    await Promise.all([
      supabase
        .from("lead_campaign_sends")
        .update({
          resend_email_id: resendId,
          sent_at: new Date().toISOString(),
        })
        .eq("id", sendRow.id),
      supabase
        .from("lead_campaigns")
        .update({ status: "sent", body_html: trackedHtml })
        .eq("id", campaign.id),
    ]);

    await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      type: "email_sent",
      subject: renderedSubject,
      body: trackedHtml,
      resend_email_id: resendId,
      performed_by: user.id,
      payload: {
        template_slug: data.templateSlug ?? null,
        mocked,
        campaign_id: campaign.id,
        campaign_send_id: sendRow.id,
        tracking_token: sendRow.tracking_token,
      },
    });

    await markFirstContacted(supabase, data.leadId);

    revalidatePath(`/leads/${data.leadId}`);
    revalidatePath("/leads/recovery");
    return { emailId: resendId, mocked };
  },
});

// ---------------- LOG INTERACTIONS (call / email / note) ----------------

const CALL_OUTCOME_LABEL: Record<string, string> = {
  connected: "Contactado",
  voicemail: "Buzón de voz",
  no_answer: "Sin respuesta",
  busy: "Comunicando",
  wrong_number: "Número erróneo",
};

export const logLeadCall = defineAction({
  name: "leads.logCall",
  schema: LogCallInput,
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const { leadId, notes, transcript, durationMinutes, outcome } = data;

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
    if (error) throw new Error(error.message);

    await markFirstContacted(supabase, leadId);
  },
});

export const logLeadEmail = defineAction({
  name: "leads.logEmail",
  schema: LogEmailInput,
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const { leadId, direction, subject, bodyHtml, counterparty } = data;

    const supabase = await createServerClient();
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: leadId,
      type: direction === "incoming" ? "email_received" : "email_sent",
      subject,
      body: bodyHtml?.trim() || null,
      performed_by: user.id,
      payload: { manual: true, direction, counterparty: counterparty ?? null },
    });
    if (error) throw new Error(error.message);

    await markFirstContacted(supabase, leadId);
  },
});

export const logLeadNote = defineAction({
  name: "leads.logNote",
  schema: LogNoteInput,
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const { leadId, content } = data;

    const supabase = await createServerClient();
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: leadId,
      type: "note",
      body: content.trim(),
      performed_by: user.id,
    });
    if (error) throw new Error(error.message);
  },
});

// ---------------- ASSIGN OWNER ----------------

/**
 * Assigns (or clears) the team member responsible for a lead and records the
 * change in the interactions timeline as `owner_change`, so the history shows
 * who took ownership and when. No-ops when the owner is unchanged.
 */
export const assignLeadOwner = defineAction({
  name: "leads.assignOwner",
  schema: AssignLeadOwnerInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => ["/leads", `/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    const supabase = await createServerClient();

    const { data: current } = await supabase
      .from("leads")
      .select("assigned_to")
      .eq("id", data.leadId)
      .single();

    const previousId = (current?.assigned_to as string | null) ?? null;
    const nextId = data.assigneeId ?? null;
    if (previousId === nextId) return;

    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: nextId, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);

    // Resolve names for a readable `from → to` timeline entry.
    const ids = [previousId, nextId].filter((v): v is string => v !== null);
    const nameById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: members } = await supabase
        .from("team_members")
        .select("id, name")
        .in("id", ids);
      for (const m of members ?? []) nameById.set(m.id as string, (m.name as string) ?? "");
    }
    const label = (id: string | null) => (id ? (nameById.get(id) ?? "?") : "Sin asignar");

    await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      type: "owner_change",
      subject: `Responsable: ${label(previousId)} → ${label(nextId)}`,
      performed_by: user.id,
      payload: { from: previousId, to: nextId },
    });
  },
});

// ---------------- CALENDAR (Google Workspace) ----------------

/**
 * Step 1 — Check for conflicts on the shared calendar without creating anything.
 * Returns the overlapping events so the user can decide whether to proceed.
 */
export const checkLeadMeetingSlot = defineAction({
  name: "leads.checkMeetingSlot",
  schema: CheckMeetingSlotInput,
  roles: ["owner", "admin", "member"],
  handler: async (data, { user }): Promise<{ conflicts: CalendarBusySlot[] }> => {
    if (!isGoogleEnabled()) return { conflicts: [] };
    const calendarId = serverEnv().GOOGLE_CALENDAR_ID;
    if (!calendarId) return { conflicts: [] };
    const subject = resolveSubject(user.email);

    const conflicts = await findConflicts({
      subject,
      calendarId,
      start: new Date(data.start),
      end: new Date(data.end),
    });
    return { conflicts };
  },
});

/**
 * Step 2 — Create the meeting on the shared calendar and record it as a
 * `meeting` interaction in the lead timeline.
 */
export const scheduleLeadMeeting = defineAction<
  typeof ScheduleLeadMeetingInput,
  { eventId: string; htmlLink: string | null; meetUrl: string | null }
>({
  name: "leads.scheduleMeeting",
  schema: ScheduleLeadMeetingInput,
  roles: ["owner", "admin", "member"],
  revalidate: (_payload, input) => [`/leads/${input.leadId}`],
  handler: async (data, { user }) => {
    if (!isGoogleEnabled()) throw new Error("Google Workspace no está configurado");
    const calendarId = serverEnv().GOOGLE_CALENDAR_ID;
    if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID no configurado");
    const subject = resolveSubject(user.email);

    const event = await insertEvent({
      subject,
      calendarId,
      summary: data.title,
      description: data.description,
      start: new Date(data.start),
      end: new Date(data.end),
      attendees: data.attendeeEmails,
      withMeet: data.withMeet,
    });

    const supabase = await createServerClient();
    const { error } = await supabase.from("lead_interactions").insert({
      lead_id: data.leadId,
      type: "meeting",
      subject: data.title,
      body: data.description ?? null,
      performed_by: user.id,
      project_id: data.projectId ?? null,
      payload: {
        calendar_event_id: event.id,
        calendar_html_link: event.htmlLink,
        meet_url: event.meetUrl,
        start: data.start,
        end: data.end,
        attendees: data.attendeeEmails ?? [],
      },
    });
    if (error) throw new Error(error.message);

    await markFirstContacted(supabase, data.leadId);

    return { eventId: event.id, htmlLink: event.htmlLink, meetUrl: event.meetUrl };
  },
});
