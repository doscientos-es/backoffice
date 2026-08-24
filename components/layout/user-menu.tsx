"use client";

import {
  CircleAlert as AlertCircle,
  ChevronRight,
  LogOut,
  Shield,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser, MemberRole } from "@/lib/auth";
import { getBrowserClient } from "@/lib/supabase/browser";
import { memberAvatarUrl } from "@/lib/utils";

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

export function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const canManageTeam = user.role === "owner" || user.role === "admin";
  const avatarSrc = memberAvatarUrl(user, 64);

  async function signOut(e: Event) {
    e.preventDefault();
    setSignOutError(null);
    const supabase = getBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSignOutError(error.message);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full border-0 bg-transparent p-0 shadow-none"
          aria-label="Menú de usuario"
        >
          <Avatar>
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt={user.name} referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-2">
        <DropdownMenuLabel className="rounded-lg bg-muted/50 p-3 font-normal">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar size="lg" className="shrink-0">
              {avatarSrc ? (
                <AvatarImage src={avatarSrc} alt="" referrerPolicy="no-referrer" />
              ) : null}
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {user.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              <Badge variant={ROLE_VARIANT[user.role]} className="mt-1.5">
                <ShieldCheck className="size-3" aria-hidden />
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuLabel className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wide">
          Mi cuenta
        </DropdownMenuLabel>
        <DropdownMenuItem asChild className="rounded-lg p-2">
          <Link href="/settings/profile" className="gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <UserRound className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">Mi perfil</span>
              <span className="block truncate text-xs text-muted-foreground">
                Datos personales y firma
              </span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-lg p-2">
          <Link href="/settings/security" className="gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <Shield className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">Seguridad</span>
              <span className="block truncate text-xs text-muted-foreground">
                MFA, passkeys y acceso
              </span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </DropdownMenuItem>
        {canManageTeam ? (
          <>
            <DropdownMenuLabel className="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wide">
              Organización
            </DropdownMenuLabel>
            <DropdownMenuItem asChild className="rounded-lg p-2">
              <Link href="/settings/team" className="gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Users className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">Equipo</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Miembros, roles y permisos
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem onSelect={signOut} variant="destructive" className="gap-3 px-3 py-2">
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
        {signOutError ? (
          <div
            role="alert"
            className="mx-1 mt-1 flex items-start gap-1.5 rounded-sm bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{signOutError}</span>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
