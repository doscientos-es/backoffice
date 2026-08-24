export type CallInteractionDetails = {
  transcript: string | null;
  durationMinutes: number | null;
  outcome: string | null;
  callDate: string | null;
};

export type LeadInteractionForAI = {
  type: string;
  subject: string | null;
  body: string | null;
  payload: unknown;
  created_at: string;
};

type ResendInteraction = {
  resend_email_id: string | null;
  type: string;
};

/** Groups repeated provider callbacks while retaining a count for the UI. */
export function groupResendInteractions<T extends ResendInteraction>(interactions: T[]) {
  const groups = new Map<string, { interaction: T; count: number }>();
  const result: Array<{ interaction: T; count: number }> = [];

  for (const interaction of interactions) {
    if (!interaction.resend_email_id) {
      result.push({ interaction, count: 1 });
      continue;
    }

    const key = `${interaction.resend_email_id}:${interaction.type}`;
    const group = groups.get(key);
    if (group) {
      group.count++;
      continue;
    }

    const next = { interaction, count: 1 };
    groups.set(key, next);
    result.push(next);
  }

  return result;
}

/** Safely reads the structured metadata stored on a call interaction. */
export function getCallInteractionDetails(payload: unknown): CallInteractionDetails {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { transcript: null, durationMinutes: null, outcome: null, callDate: null };
  }

  const data = payload as Record<string, unknown>;
  const transcript = typeof data.transcript === "string" ? data.transcript.trim() : "";
  const durationMinutes =
    typeof data.duration_minutes === "number" && Number.isFinite(data.duration_minutes)
      ? data.duration_minutes
      : null;
  const outcome = typeof data.outcome === "string" ? data.outcome : null;
  const callDate =
    typeof data.call_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.call_date)
      ? data.call_date
      : null;

  return {
    transcript: transcript || null,
    durationMinutes,
    outcome,
    callDate,
  };
}

/** Returns the business date of an interaction, falling back to its audit timestamp. */
export function interactionDate(interaction: LeadInteractionForAI): string {
  if (interaction.type !== "call") return interaction.created_at;
  return getCallInteractionDetails(interaction.payload).callDate ?? interaction.created_at;
}

function describeInteractionAge(interaction: LeadInteractionForAI, relativeTo: Date): string | null {
  const occurredAt = new Date(interactionDate(interaction));
  if (Number.isNaN(occurredAt.getTime()) || Number.isNaN(relativeTo.getTime())) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const occurredDay = Date.UTC(
    occurredAt.getUTCFullYear(),
    occurredAt.getUTCMonth(),
    occurredAt.getUTCDate(),
  );
  const relativeDay = Date.UTC(
    relativeTo.getUTCFullYear(),
    relativeTo.getUTCMonth(),
    relativeTo.getUTCDate(),
  );
  const days = Math.floor((relativeDay - occurredDay) / dayMs);

  if (days < 0) return `dentro de ${Math.abs(days)} día${days === -1 ? "" : "s"}`;
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;

  const months = Math.round(days / 30);
  if (days < 365) return `hace aprox. ${months} mes${months === 1 ? "" : "es"} (${days} días)`;

  const years = Math.round(days / 365);
  return `hace aprox. ${years} año${years === 1 ? "" : "s"} (${days} días)`;
}

/** Formats one interaction for an AI prompt, optionally making its age explicit. */
export function formatInteractionForAI(
  interaction: LeadInteractionForAI,
  relativeTo?: Date,
): string {
  const date = interactionDate(interaction).slice(0, 10);
  const age = relativeTo ? describeInteractionAge(interaction, relativeTo) : null;
  const subject = interaction.subject?.trim();
  const notes = interaction.body?.trim()?.slice(0, 300);
  const callDetails =
    interaction.type === "call" ? getCallInteractionDetails(interaction.payload) : null;
  const transcript = callDetails?.transcript?.slice(0, 2000);
  const callMetadata = callDetails
    ? [
      callDetails.outcome ? `Resultado: ${callDetails.outcome}` : null,
      callDetails.durationMinutes != null ? `Duración: ${callDetails.durationMinutes} min` : null,
    ]
      .filter(Boolean)
      .join(" · ")
    : "";
  const meetingData =
    interaction.type === "meeting" && interaction.payload && typeof interaction.payload === "object"
      ? (interaction.payload as Record<string, unknown>)
      : null;
  const meetingTime = meetingData?.start
    ? `Reunión: ${String(meetingData.start)}${meetingData.end ? ` → ${String(meetingData.end)}` : ""}`
    : "";

  return `- ${date}${age ? ` (${age})` : ""} | ${interaction.type}${subject ? ` | "${subject}"` : ""}${notes ? ` | Notas: ${notes}` : ""
    }${callMetadata ? ` | ${callMetadata}` : ""}${meetingTime ? ` | ${meetingTime}` : ""}${transcript ? ` | Transcripción: ${transcript}` : ""
    }`;
}
