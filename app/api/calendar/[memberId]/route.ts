import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function icsDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsDateOnly(dateStr: string): string {
  // YYYYMMDD format (all-day events)
  return dateStr.replace(/-/g, "");
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildEvent(uid: string, summary: string, dtstart: string, dtend: string, description?: string, allDay = false) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`,
    allDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`,
    `SUMMARY:${escapeIcs(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;

  // Use service-role client (this endpoint uses its own token validation below)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Validate member exists
  const { data: member } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!member) return new NextResponse("Not found", { status: 404 });

  // Fetch tasks assigned to this member with a due_date
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, due_date, status, projects(name)")
    .eq("assignee_id", memberId)
    .not("due_date", "is", null)
    .is("deleted_at", null)
    .order("due_date", { ascending: true });

  // Fetch completed time entries for this member
  const { data: timeEntries } = await supabase
    .from("time_entries")
    .select("id, description, started_at, ended_at, projects(name), task:task_id(title)")
    .eq("member_id", memberId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(200);

  const events: string[] = [];

  // Task due dates → all-day events
  for (const task of tasks ?? []) {
    const dueDate = task.due_date as string;
    const startStr = icsDateOnly(dueDate);
    // All-day events: DTEND is the day after
    const endDate = new Date(dueDate);
    endDate.setDate(endDate.getDate() + 1);
    const endStr = endDate.toISOString().split("T")[0]!.replace(/-/g, "");
    const project = (task as unknown as { projects: { name: string } | null }).projects;
    const summary = project ? `[${project.name}] ${task.title as string}` : (task.title as string);
    events.push(buildEvent(
      `task-${task.id as string}@doscientos`,
      summary,
      startStr,
      endStr,
      (task.description as string | null) ?? undefined,
      true,
    ));
  }

  // Time entries → timed events
  for (const entry of timeEntries ?? []) {
    const startedAt = entry.started_at as string;
    const endedAt = entry.ended_at as string;
    const project = (entry as unknown as { projects: { name: string } | null }).projects;
    const task = (entry as unknown as { task: { title: string } | null }).task;
    const label = task?.title ?? (entry.description as string | null) ?? "Tiempo de trabajo";
    const summary = project ? `[${project.name}] ${label}` : label;
    events.push(buildEvent(
      `time-${entry.id as string}@doscientos`,
      summary,
      icsDate(startedAt),
      icsDate(endedAt),
    ));
  }

  const memberName = member.name as string;
  const icsBody = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//doscientos//CRM//ES",
    `X-WR-CALNAME:doscientos - ${memberName}`,
    "X-WR-TIMEZONE:Europe/Madrid",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(icsBody, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="doscientos-${memberId}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
