"use server";

import { type MemberRole, requireRole } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = { ok: true } | { ok: false; error: string };

const ASSIGNABLE_ROLES = ["owner", "admin", "member", "viewer"] as const;
const RoleEnum = z.enum(ASSIGNABLE_ROLES);

const InviteInput = z.object({
  name: z.string().trim().max(160, "El nombre no puede superar 160 caracteres").optional(),
  email: z.string().email("Email no válido").max(200),
  role: RoleEnum,
});

const RoleInput = z.object({
  memberId: z.string().uuid(),
  role: RoleEnum,
});

const MemberIdInput = z.object({ memberId: z.string().uuid() });

function canAssignRole(actor: MemberRole, target: MemberRole): boolean {
  if (target === "owner") return actor === "owner";
  return actor === "owner" || actor === "admin";
}

/**
 * Turns a Supabase auth error into a readable Spanish message. Supabase errors
 * are `Error` instances whose properties are non-enumerable, so a naive
 * `String(err)` / `JSON.stringify(err)` can surface as "{}". We inspect the
 * known fields and map the common invite failures (rate limit, email delivery)
 * to actionable text.
 */
function describeInviteError(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  const code = (error as { code?: string } | null)?.code?.toLowerCase() ?? "";
  const raw = (error as { message?: string } | null)?.message?.trim() ?? "";
  const lower = raw.toLowerCase();

  if (status === 429 || lower.includes("rate limit")) {
    return "Límite de emails alcanzado. Espera unos minutos antes de reintentar.";
  }
  if (lower.includes("already been registered") || lower.includes("already registered")) {
    return "Ese email ya tiene cuenta. Búscalo en la lista o reactívalo.";
  }
  // Postgres trigger/constraint failure while inserting into auth.users. GoTrue
  // wraps these as a 500 with code "unexpected_failure" and often an empty
  // message (which serializes to "{}"), so match on the code/text explicitly.
  if (
    code === "unexpected_failure" ||
    lower.includes("database error saving new user") ||
    lower.includes("database error")
  ) {
    return raw
      ? `Error de base de datos al crear el usuario: ${raw}`
      : "Error de base de datos al crear el usuario. Revisa los triggers de auth.users (p. ej. restricciones de email).";
  }
  if (lower.includes("error sending") || lower.includes("smtp") || status === 500) {
    // SMTP is configured (Resend); surface the real provider error so we can
    // see the actual cause (e.g. unverified sender domain) instead of a
    // misleading "falta configurar SMTP" message.
    return raw
      ? `El proveedor de email rechazó el envío: ${raw}`
      : "El proveedor de email (Resend) rechazó el envío. Revisa que el dominio del remitente esté verificado.";
  }
  return raw || "No se pudo enviar la invitación.";
}

export async function inviteTeamMember(formData: FormData): Promise<ActionResult> {
  const actor = await requireRole(["owner", "admin"]);
  const parsed = InviteInput.safeParse({
    name: formData.get("name")?.toString() ?? "",
    email: formData.get("email")?.toString().trim().toLowerCase() ?? "",
    role: formData.get("role")?.toString() ?? "member",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }
  if (!canAssignRole(actor.role, parsed.data.role)) {
    return { ok: false, error: "No tienes permisos para asignar ese rol." };
  }

  const { email, role } = parsed.data;
  // Name is optional: fall back to the email local-part so the member always
  // has a readable label until they set their real name during onboarding.
  const name = parsed.data.name || email.split("@")[0];

  const admin = createAdminClient();
  // Google-first onboarding: the invite email is an accept + auto-login link.
  // Clicking it exchanges the PKCE code (confirming the email and creating a
  // session) and lands the invitee straight on /onboarding — no password step.
  // Once the email is confirmed, future sign-ins go through "Continuar con
  // Google", which Supabase auto-links to this account by matching the email.
  const redirectTo = `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/onboarding")}`;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo,
  });
  if (inviteError || !invited?.user) {
    // Log the full error server-side; the client only ever gets a readable
    // string (never "{}" from a serialized Error, whose props are non-enumerable).
    console.error("[inviteTeamMember] inviteUserByEmail failed", {
      email,
      status: (inviteError as { status?: number } | null)?.status,
      code: (inviteError as { code?: string } | null)?.code,
      message: inviteError?.message,
    });
    return { ok: false, error: describeInviteError(inviteError) };
  }

  const { error: upsertError } = await admin.from("team_members").upsert(
    {
      id: invited.user.id,
      email,
      name,
      role,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (upsertError) return { ok: false, error: upsertError.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function updateMemberRole(input: unknown): Promise<ActionResult> {
  const actor = await requireRole(["owner", "admin"]);
  const parsed = RoleInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos" };

  if (parsed.data.memberId === actor.id) {
    return { ok: false, error: "No puedes cambiar tu propio rol." };
  }
  if (!canAssignRole(actor.role, parsed.data.role)) {
    return { ok: false, error: "No tienes permisos para asignar ese rol." };
  }

  const supabase = await createServerClient();
  const { data: target } = await supabase
    .from("team_members")
    .select("role")
    .eq("id", parsed.data.memberId)
    .maybeSingle();
  if (target?.role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "Solo un propietario puede modificar a otro propietario." };
  }

  const { error } = await supabase
    .from("team_members")
    .update({ role: parsed.data.role, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.memberId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function deactivateMember(input: unknown): Promise<ActionResult> {
  const actor = await requireRole(["owner", "admin"]);
  const parsed = MemberIdInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos" };
  if (parsed.data.memberId === actor.id) {
    return { ok: false, error: "No puedes desactivarte a ti mismo." };
  }

  const supabase = await createServerClient();
  const { data: target } = await supabase
    .from("team_members")
    .select("role")
    .eq("id", parsed.data.memberId)
    .maybeSingle();
  if (target?.role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "Solo un propietario puede desactivar a otro propietario." };
  }

  const { error } = await supabase
    .from("team_members")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", parsed.data.memberId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function reactivateMember(input: unknown): Promise<ActionResult> {
  await requireRole(["owner", "admin"]);
  const parsed = MemberIdInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("team_members")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.memberId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

/**
 * Hard-delete a team member. Owner-only and only allowed on already
 * deactivated members — irreversible. Deletes the auth.users row which
 * cascades to team_members and frees the email for future invitations.
 * Most FKs to team_members use `on delete set null` so historical
 * references survive; `task_comments.author_id` is `on delete restrict`
 * and will block deletion with a clean error message.
 */
export async function deleteMember(input: unknown): Promise<ActionResult> {
  const actor = await requireRole(["owner"]);
  const parsed = MemberIdInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos no válidos" };
  if (parsed.data.memberId === actor.id) {
    return { ok: false, error: "No puedes eliminarte a ti mismo." };
  }

  const admin = createAdminClient();
  const { data: target, error: lookupError } = await admin
    .from("team_members")
    .select("deleted_at")
    .eq("id", parsed.data.memberId)
    .maybeSingle();
  if (lookupError) return { ok: false, error: lookupError.message };
  if (!target) return { ok: false, error: "Miembro no encontrado." };
  if (!target.deleted_at) {
    return { ok: false, error: "Desactiva el miembro antes de eliminarlo." };
  }

  const { error: authError } = await admin.auth.admin.deleteUser(parsed.data.memberId);
  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes("foreign key") || msg.includes("violates")) {
      return {
        ok: false,
        error: "No se puede eliminar: el miembro tiene comentarios u otros registros vinculados.",
      };
    }
    return { ok: false, error: authError.message };
  }

  revalidatePath("/settings/team");
  return { ok: true };
}
