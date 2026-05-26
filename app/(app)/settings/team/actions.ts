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
  name: z.string().min(1, "El nombre es obligatorio").max(160),
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

  const admin = createAdminClient();
  const redirectTo = `${publicEnv.NEXT_PUBLIC_APP_URL}/login/update-password`;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { data: { name: parsed.data.name }, redirectTo },
  );
  if (inviteError || !invited?.user) {
    return { ok: false, error: inviteError?.message ?? "No se pudo enviar la invitación." };
  }

  const { error: upsertError } = await admin.from("team_members").upsert(
    {
      id: invited.user.id,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
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
