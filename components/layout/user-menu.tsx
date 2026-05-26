"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { AlertCircle, LogOut, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 pr-2 pl-1"
          aria-label="Menú de usuario"
        >
          <Avatar size="sm">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-xs font-medium text-[color:var(--text-primary)] md:inline">
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1 pb-2">
          <span className="truncate text-sm font-medium text-[color:var(--text-primary)]">
            {user.name}
          </span>
          <span className="truncate text-xs font-normal text-[color:var(--text-muted)]">
            {user.email}
          </span>
          <Badge variant={ROLE_VARIANT[user.role]} className="mt-1 self-start">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            {ROLE_LABELS[user.role]}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" aria-hidden />
            Ajustes
          </Link>
        </DropdownMenuItem>
        {canManageTeam ? (
          <DropdownMenuItem asChild>
            <Link href="/settings/team">
              <Users className="h-4 w-4" aria-hidden />
              Equipo
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} variant="destructive">
          <LogOut className="h-4 w-4" aria-hidden />
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
