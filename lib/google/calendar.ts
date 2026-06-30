/**
 * Agenda de leads vía Google Calendar (service account, domain-wide delegation).
 *
 * Flujo en dos pasos:
 *  1. `findConflicts` — lista eventos solapados con la franja propuesta.
 *  2. `insertEvent`   — crea el evento (con Meet) una vez el equipo confirma.
 */
import { GOOGLE_SCOPES, googleFetch } from "./client";

const BASE = "https://www.googleapis.com/calendar/v3/calendars";

/** Evento mínimo devuelto por events.list para detectar conflictos. */
export type CalendarBusySlot = {
  id: string;
  summary: string | null;
  start: string | null;
  end: string | null;
};

type EventsListResponse = {
  items?: Array<{
    id: string;
    summary?: string;
    status?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }>;
};

/**
 * Devuelve los eventos del `calendarId` que solapan [start, end). Usa
 * `singleEvents` para expandir recurrencias y excluye cancelados.
 */
export async function findConflicts(opts: {
  subject: string;
  calendarId: string;
  start: Date;
  end: Date;
}): Promise<CalendarBusySlot[]> {
  const params = new URLSearchParams({
    timeMin: opts.start.toISOString(),
    timeMax: opts.end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });
  const url = `${BASE}/${encodeURIComponent(opts.calendarId)}/events?${params}`;
  const data = await googleFetch<EventsListResponse>(opts.subject, [GOOGLE_SCOPES.calendar], url);

  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      id: e.id,
      summary: e.summary ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
    }));
}

export type InsertEventInput = {
  subject: string;
  calendarId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  /** Zona horaria IANA, p.ej. "Europe/Madrid". */
  timeZone?: string;
  /** Emails de invitados (lead, equipo). */
  attendees?: string[];
  /** Si true, adjunta un enlace de Google Meet al evento. */
  withMeet?: boolean;
};

export type InsertedEvent = { id: string; htmlLink: string | null; meetUrl: string | null };

/** Crea un evento en el calendario indicado. Lanza si la API falla. */
export async function insertEvent(input: InsertEventInput): Promise<InsertedEvent> {
  const tz = input.timeZone ?? "Europe/Madrid";
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: tz },
    end: { dateTime: input.end.toISOString(), timeZone: tz },
  };
  if (input.attendees?.length) {
    body.attendees = input.attendees.map((email) => ({ email }));
  }
  if (input.withMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: `doscientos-${Date.now().toString(36)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const params = new URLSearchParams({ sendUpdates: "all" });
  if (input.withMeet) params.set("conferenceDataVersion", "1");
  const url = `${BASE}/${encodeURIComponent(input.calendarId)}/events?${params}`;

  const data = await googleFetch<{
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
  }>(input.subject, [GOOGLE_SCOPES.calendar], url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    id: data.id,
    htmlLink: data.htmlLink ?? null,
    meetUrl: data.hangoutLink ?? null,
  };
}
