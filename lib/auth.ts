import { scopedLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const log = scopedLogger("auth");

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  avatarUrl: string | null;
  emailAlias: string | null;
  githubHandle: string | null;
  onboardedAt: string | null;
  jobTitle: string | null;
  phone: string | null;
  contactEmail: string | null;
};

export type AuthFailureReason =
  | "no_session"
  | "no_team_member"
  | "team_member_deleted"
  | "db_error";

export type AuthResult = { ok: true; user: CurrentUser } | { ok: false; reason: AuthFailureReason };

/**
 * Resolve the authenticated user + their team_member row.
 * Returns a discriminated result so callers can distinguish between
 * "no session" and "session but unauthorized" — never silent nulls.
 */
export async function getCurrentUser(): Promise<AuthResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "no_session" };

  const { data: member, error } = await supabase
    .from("team_members")
    .select(
      "id, name, email, role, avatar_url, email_alias, github_handle, onboarded_at, deleted_at, job_title, phone, contact_email",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    log.error({ err: error, userId: user.id }, "team_members lookup failed");
    return { ok: false, reason: "db_error" };
  }
  if (!member) {
    log.warn({ userId: user.id, email: user.email }, "session without team_member row");
    return { ok: false, reason: "no_team_member" };
  }
  if (member.deleted_at) {
    return { ok: false, reason: "team_member_deleted" };
  }

  return {
    ok: true,
    user: {
      id: member.id as string,
      email: member.email as string,
      name: member.name as string,
      role: member.role as MemberRole,
      avatarUrl: (member.avatar_url as string | null) ?? null,
      emailAlias: (member.email_alias as string | null) ?? null,
      githubHandle: (member.github_handle as string | null) ?? null,
      onboardedAt: (member.onboarded_at as string | null) ?? null,
      jobTitle: (member.job_title as string | null) ?? null,
      phone: (member.phone as string | null) ?? null,
      contactEmail: (member.contact_email as string | null) ?? null,
    },
  };
}

export interface RequireUserOptions {
  /**
   * When `true`, skip the "must complete onboarding" check. Used inside
   * the `/onboarding` route itself to avoid an infinite redirect loop.
   */
  allowUnonboarded?: boolean;
}

/**
 * Guard for Server Components. On failure redirects to /login with an
 * `error` query param so the login page can render actionable feedback.
 * Pending-onboarding users are redirected to `/onboarding` unless
 * `allowUnonboarded` is set.
 */
export async function requireUser(opts?: RequireUserOptions): Promise<CurrentUser> {
  const result = await getCurrentUser();
  if (!result.ok) {
    if (result.reason === "no_session") redirect("/login");
    redirect(`/login?error=${result.reason}`);
  }
  if (!opts?.allowUnonboarded && !result.user.onboardedAt) {
    redirect("/onboarding");
  }
  return result.user;
}

/**
 * Guard for Server Components that require one of the given roles.
 */
export async function requireRole(roles: MemberRole[]): Promise<CurrentUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/inicio?error=forbidden");
  return u;
}

/**
 * Returns true only for roles that can see billing/financial data (owner, admin).
 * members and viewers should not see revenue, expenses, or accounts-receivable figures.
 */
export function canViewFinance(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}
