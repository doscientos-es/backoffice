import { requireUser } from "@/lib/auth";
import { getCalendarEvents } from "@/lib/calendar/queries";
import { ALL_LAYERS } from "@/lib/calendar/types";
import { createServerClient } from "@/lib/supabase/server";
import { addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek, subMonths } from "date-fns";
import type { Metadata } from "next";
import { CalendarGrid } from "./_components/calendar-grid";

export const metadata: Metadata = { title: "Agenda · doscientos" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseView(v: unknown): "month" | "week" | "agenda" {
  if (v === "week" || v === "agenda") return v;
  return "month";
}

function parseDate(v: unknown): Date {
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requireUser();

  const isAdminOrOwner = user.role === "admin" || user.role === "owner";
  const view = parseView(sp.view);
  const anchor = parseDate(sp.date);

  // Determine fetch window based on view
  let from: Date;
  let to: Date;
  if (view === "week") {
    from = startOfWeek(anchor, { weekStartsOn: 1 });
    to = endOfWeek(anchor, { weekStartsOn: 1 });
  } else if (view === "agenda") {
    from = startOfMonth(anchor);
    to = endOfMonth(addMonths(anchor, 2));
  } else {
    // month — include overflow days from prev/next month
    from = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    to = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  }

  // For admins: always fetch all members (member chips handle client-side filtering)
  const supabase = await createServerClient();
  let memberIds = [user.id];
  let teamMembers: {
    id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
    github_handle: string | null;
  }[] = [];
  if (isAdminOrOwner) {
    const { data } = await supabase
      .from("team_members")
      .select("id, name, email, avatar_url, github_handle")
      .is("deleted_at", null)
      .order("name");
    const rows = (data ?? []) as {
      id: string;
      name: string;
      email: string | null;
      avatar_url: string | null;
      github_handle: string | null;
    }[];
    memberIds = rows.map((m) => m.id);
    teamMembers = rows;
  }

  // Fetch the user's calendar token for the "Conectar Google Calendar" feature
  const { data: memberRow } = await supabase
    .from("team_members")
    .select("calendar_token")
    .eq("id", user.id)
    .maybeSingle();
  const calendarToken = (memberRow?.calendar_token as string | null) ?? null;

  // Fetch active leads and projects for the create dialog
  const [{ data: leadsData }, { data: projectsData }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, email, company")
      .not("status", "in", '("won","lost")')
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(150),
    supabase
      .from("projects")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
  ]);
  const leads = (leadsData ?? []) as {
    id: string;
    name: string;
    email: string | null;
    company: string | null;
  }[];
  const projects = (projectsData ?? []) as { id: string; name: string }[];

  const events = await getCalendarEvents({
    from,
    to,
    memberIds,
    layers: ALL_LAYERS,
    isAdmin: isAdminOrOwner,
  });

  return (
    <CalendarGrid
      events={events}
      view={view}
      anchor={anchor.toISOString()}
      teamMembers={teamMembers}
      leads={leads}
      projects={projects}
      prevMonth={subMonths(anchor, 1).toISOString()}
      nextMonth={addMonths(anchor, 1).toISOString()}
      calendarToken={calendarToken}
    />
  );
}
