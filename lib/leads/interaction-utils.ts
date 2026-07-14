export type CallInteractionDetails = {
  transcript: string | null;
  durationMinutes: number | null;
  outcome: string | null;
};

export type LeadInteractionForAI = {
  type: string;
  subject: string | null;
  body: string | null;
  payload: unknown;
  created_at: string;
};

/** Safely reads the structured metadata stored on a call interaction. */
export function getCallInteractionDetails(payload: unknown): CallInteractionDetails {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { transcript: null, durationMinutes: null, outcome: null };
  }

  const data = payload as Record<string, unknown>;
  const transcript = typeof data.transcript === "string" ? data.transcript.trim() : "";
  const durationMinutes =
    typeof data.duration_minutes === "number" && Number.isFinite(data.duration_minutes)
      ? data.duration_minutes
      : null;
  const outcome = typeof data.outcome === "string" ? data.outcome : null;

  return {
    transcript: transcript || null,
    durationMinutes,
    outcome,
  };
}

/** Formats one interaction for the lead-analysis prompt without losing calls' transcripts. */
export function formatInteractionForAI(interaction: LeadInteractionForAI): string {
  const date = new Date(interaction.created_at).toISOString().slice(0, 10);
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

  return `- ${date} | ${interaction.type}${subject ? ` | "${subject}"` : ""}${
    notes ? ` | Notas: ${notes}` : ""
  }${callMetadata ? ` | ${callMetadata}` : ""}${meetingTime ? ` | ${meetingTime}` : ""}${
    transcript ? ` | Transcripción: ${transcript}` : ""
  }`;
}
