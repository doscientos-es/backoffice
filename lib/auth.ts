import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  emailAlias: string | null;
  signatureHtml: string | null;
  emailSendEnabled: boolean;
};

/**
 * Read the authenticated user + their team_member row.
 * Returns null when there's no session (no redirect — caller decides).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("team_members")
    .select("id, name, email, role, email_alias, signature_html, email_send_enabled")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!member) return null;
  return {
    id: member.id as string,
    email: member.email as string,
    name: member.name as string,
    role: member.role as MemberRole,
    emailAlias: (member.email_alias as string | null) ?? null,
    signatureHtml: (member.signature_html as string | null) ?? null,
    emailSendEnabled: (member.email_send_enabled as boolean | null) ?? false,
  };
}

/**
 * Guard for Server Components. Redirects to /login when there is no session.
 */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/**
 * Guard for Server Components that require a specific role.
 */
export async function requireRole(roles: MemberRole[]): Promise<CurrentUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/inicio");
  return u;
}
