"use server";

import { requireUser } from "@/lib/auth";
import { isGoogleEnabled, serverEnv } from "@/lib/env";
import { insertEvent } from "@/lib/google/calendar";
import { resolveSubject } from "@/lib/google/client";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CalendarEvent, CalendarEventKind } from "./types";

export type RescheduleResult = { ok: true } | { ok: false; error: string };

/**
 * Updates the date of a draggable calendar event.
 * Only tasks (due_date) and reminders (remind_at) are editable.
 * Reminder time is preserved; only the date is shifted.
 */
export async function rescheduleEvent(opts: {
  kind: CalendarEventKind;
  sourceId: string;
  newStart: string; // ISO date (YYYY-MM-DD) for all-day, ISO datetime for timed
}): Promise<RescheduleResult> {
  const user = await requireUser();
  const supabase = await createServerClient();

  if (opts.kind === "task") {
    const { error } = await supabase
      .from("tasks")
      .update({ due_date: opts.newStart })
      .eq("id", opts.sourceId)
      .eq("assignee_id", user.id); // member can only move their own tasks
    if (error) return { ok: false, error: error.message };
    revalidatePath("/calendar");
    return { ok: true };
  }

  if (opts.kind === "reminder") {
    // Fetch current remind_at to preserve time-of-day
    const { data, error: fetchError } = await supabase
      .from("reminders")
      .select("remind_at")
      .eq("id", opts.sourceId)
      .eq("created_by", user.id)
      .single();
    if (fetchError || !data) return { ok: false, error: fetchError?.message ?? "Not found" };

    const existing = new Date(data.remind_at as string);
    const [year, month, day] = opts.newStart.split("-").map(Number);
    const newDate = new Date(existing);
    newDate.setFullYear(year, month - 1, day);

    const { error } = await supabase
      .from("reminders")
      .update({ remind_at: newDate.toISOString() })
      .eq("id", opts.sourceId)
      .eq("created_by", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/calendar");
    return { ok: true };
  }

  return { ok: false, error: "Event type is not editable" };
}

// ── Create event ──────────────────────────────────────────────────────────────

export type CreateCalendarEventInput = {
  kind: "task" | "reminder" | "google_meeting";
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM — optional for tasks, required for meetings
  endTime?: string; // HH:MM — only for meetings
  description?: string;
  assigneeId?: string; // tasks only
  withMeet?: boolean; // google_meeting only
};

export type CreateCalendarEventResult =
  | { ok: true; event: CalendarEvent }
  | { ok: false; error: string };

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<CreateCalendarEventResult> {
  const user = await requireUser();
  const supabase = await createServerClient();

  // ── Reminder ───────────────────────────────────────────────────────────────
  if (input.kind === "reminder") {
    const remindAt = input.startTime
      ? `${input.date}T${input.startTime}:00`
      : `${input.date}T09:00:00`;
    const { data, error } = await supabase
      .from("reminders")
      .insert({
        title: input.title.trim(),
        remind_at: new Date(remindAt).toISOString(),
        notes: input.description?.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, error: error?.message ?? "No se pudo crear el recordatorio" };

    // Best-effort: push to Google Calendar so it appears in the user's calendar app
    if (isGoogleEnabled()) {
      const calendarId = serverEnv().GOOGLE_CALENDAR_ID;
      if (calendarId) {
        const remindDt = new Date(remindAt);
        try {
          await insertEvent({
            subject: resolveSubject(user.email),
            calendarId,
            summary: `[Recordatorio] ${input.title.trim()}`,
            description: input.description?.trim(),
            start: remindDt,
            end: new Date(remindDt.getTime() + 30 * 60_000), // 30 min block
            extendedProperties: {
              source: "backoffice",
              kind: "reminder",
              sourceId: data.id as string,
            },
          });
        } catch {
          // Non-fatal: reminder already saved in Supabase
        }
      }
    }

    revalidatePath("/calendar");
    revalidatePath("/reminders");
    return {
      ok: true,
      event: {
        id: `reminder:${data.id as string}`,
        kind: "reminder",
        title: input.title.trim(),
        start: remindAt,
        end: remindAt,
        allDay: !input.startTime,
        href: null,
        editable: true,
        done: false,
        memberId: user.id,
        memberName: user.name,
        meta: { description: input.description?.trim() },
      },
    };
  }

  // ── Task ───────────────────────────────────────────────────────────────────
  if (input.kind === "task") {
    const assigneeId = input.assigneeId ?? user.id;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: "todo",
        priority: 0,
        due_date: input.date,
        assignee_id: assigneeId,
        created_by: user.id,
        kanban_order: "m",
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear la tarea" };

    // Best-effort: push to Google Calendar as an all-day event on the due date
    if (isGoogleEnabled()) {
      const calendarId = serverEnv().GOOGLE_CALENDAR_ID;
      if (calendarId) {
        const dueDt = new Date(`${input.date}T00:00:00`);
        try {
          await insertEvent({
            subject: resolveSubject(user.email),
            calendarId,
            summary: `[Tarea] ${input.title.trim()}`,
            description: input.description?.trim(),
            start: dueDt,
            end: dueDt,
            allDay: true,
            extendedProperties: { source: "backoffice", kind: "task", sourceId: data.id as string },
          });
        } catch {
          // Non-fatal: task already saved in Supabase
        }
      }
    }

    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return {
      ok: true,
      event: {
        id: `task:${data.id as string}`,
        kind: "task",
        title: input.title.trim(),
        start: input.date,
        end: input.date,
        allDay: true,
        href: `/tasks/${data.id as string}`,
        editable: assigneeId === user.id,
        done: false,
        memberId: assigneeId,
        memberName: assigneeId === user.id ? user.name : null,
        meta: { description: input.description?.trim() },
      },
    };
  }

  // ── Google Meeting ─────────────────────────────────────────────────────────
  if (input.kind === "google_meeting") {
    if (!isGoogleEnabled()) return { ok: false, error: "Google Workspace no configurado" };
    const calendarId = serverEnv().GOOGLE_CALENDAR_ID;
    if (!calendarId) return { ok: false, error: "GOOGLE_CALENDAR_ID no configurado" };

    const startStr = `${input.date}T${input.startTime ?? "10:00"}:00`;
    const endStr = `${input.date}T${input.endTime ?? "11:00"}:00`;
    const startDt = new Date(startStr);
    const endDt = new Date(endStr);

    try {
      const inserted = await insertEvent({
        subject: resolveSubject(user.email),
        calendarId,
        summary: input.title.trim(),
        description: input.description?.trim(),
        start: startDt,
        end: endDt,
        withMeet: input.withMeet,
      });
      revalidatePath("/calendar");
      return {
        ok: true,
        event: {
          id: `google_meeting:${inserted.id}`,
          kind: "google_meeting",
          title: input.title.trim(),
          start: startDt.toISOString(),
          end: endDt.toISOString(),
          allDay: false,
          href: inserted.htmlLink,
          editable: false,
          done: false,
          memberId: null,
          memberName: null,
          meta: {
            meetUrl: inserted.meetUrl ?? undefined,
            description: input.description?.trim(),
          },
        },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error de Google Calendar" };
    }
  }

  return { ok: false, error: "Tipo no válido" };
}
