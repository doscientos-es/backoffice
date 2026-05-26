import { PageHeader } from "@/components/layout/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { type MemberRole, requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { InviteForm } from "./invite-form";
import { MemberRowActions } from "./member-row-actions";

export const metadata = { title: "Equipo · doscientos" };
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
  viewer: "Solo lectura",
};

const ROLE_VARIANT: Record<MemberRole, "default" | "info" | "neutral"> = {
  owner: "default",
  admin: "info",
  member: "neutral",
  viewer: "neutral",
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  created_at: string;
  deleted_at: string | null;
};

export default async function TeamSettingsPage() {
  const actor = await requireRole(["owner", "admin"]);
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("team_members")
    .select("id, name, email, role, created_at, deleted_at")
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  const members = (data ?? []) as MemberRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipo"
        description="Gestiona los miembros de tu organización, sus roles y el acceso al backoffice."
      />

      <Card>
        <CardHeader>
          <CardTitle>Invitar miembro</CardTitle>
          <CardDescription>
            Le enviaremos un email con un enlace para que defina su contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm actorRole={actor.role} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? "miembro" : "miembros"} en total.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {error ? (
            <p className="px-5 py-6 text-sm text-[color:var(--danger)]">{error.message}</p>
          ) : members.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>Aún no hay miembros</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
                  <tr>
                    <th className="px-5 py-2 font-medium">Miembro</th>
                    <th className="px-5 py-2 font-medium">Rol</th>
                    <th className="px-5 py-2 font-medium">Estado</th>
                    <th className="px-5 py-2 font-medium">Alta</th>
                    <th className="px-5 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isSelf = m.id === actor.id;
                    const isDeactivated = m.deleted_at !== null;
                    return (
                      <tr
                        key={m.id}
                        className="border-t border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
                      >
                        <td className="px-5 py-2.5 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-7">
                              <AvatarFallback>{initials(m.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {m.name}
                                {isSelf ? (
                                  <span className="ml-2 text-xs text-[color:var(--text-muted)]">
                                    (tú)
                                  </span>
                                ) : null}
                              </div>
                              <div className="truncate text-xs text-[color:var(--text-muted)]">
                                {m.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 align-middle">
                          <Badge variant={ROLE_VARIANT[m.role]}>{ROLE_LABELS[m.role]}</Badge>
                        </td>
                        <td className="px-5 py-2.5 align-middle">
                          {isDeactivated ? (
                            <Badge variant="danger">Desactivado</Badge>
                          ) : (
                            <Badge variant="success">Activo</Badge>
                          )}
                        </td>
                        <td className="px-5 py-2.5 align-middle text-[color:var(--text-secondary)]">
                          {formatDate(m.created_at)}
                        </td>
                        <td className="px-5 py-2.5 align-middle">
                          <MemberRowActions
                            memberId={m.id}
                            role={m.role}
                            isSelf={isSelf}
                            isDeactivated={isDeactivated}
                            actorRole={actor.role}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
