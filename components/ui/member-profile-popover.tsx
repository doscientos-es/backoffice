"use client";

import { UserRound as UserRound } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ReactNode } from "react";
import type { AvatarMember } from "@/components/ui/member-avatar";

export type ProfiledMember = AvatarMember & { id: string };

/**
 * Compact entry point to a member's profile. It is deliberately kept separate
 * from selection controls, where clicking an avatar has a different meaning.
 */
export function MemberProfilePopover({
  member,
  renderAvatar,
  size = "sm",
  className,
}: {
  member: ProfiledMember;
  renderAvatar: (size: "xs" | "sm" | "default" | "lg", className?: string) => ReactNode;
  size?: "xs" | "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ver información de ${member.name}`}
          title={`Ver información de ${member.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {renderAvatar(size, className)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-2"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-1 py-1.5">
          {renderAvatar("default", "size-8")}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
            <p className="text-xs text-muted-foreground">Miembro del equipo</p>
          </div>
        </div>
        <Link
          href={`/team/${member.id}`}
          className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
        >
          <UserRound className="size-3.5" aria-hidden />
          Ver perfil
        </Link>
      </PopoverContent>
    </Popover>
  );
}
