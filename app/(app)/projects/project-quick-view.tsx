"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { relativeTime } from "@/lib/utils";
import { ArrowUpRight, Building2, Calendar, ExternalLink, Layout, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { GitHubModeBadge } from "./github-mode-badge";
import type { GitHubSyncMode } from "./github-sync-section";

export type QuickProject = {
  id: string;
  name: string;
  client_name: string;
  status: "planning" | "active" | "on_hold" | "done" | "cancelled";
  description: string | null;
  updated_at: string;
  github_sync_mode?: GitHubSyncMode | null;
  github_repo?: string | null;
};

const STATUS_LABEL: Record<QuickProject["status"], string> = {
  planning: "Planificación",
  active: "Activo",
  on_hold: "En pausa",
  done: "Finalizado",
  cancelled: "Cancelado",
};

const STATUS_VARIANT: Record<QuickProject["status"], any> = {
  planning: "info",
  active: "success",
  on_hold: "warning",
  done: "neutral",
  cancelled: "danger",
};

export function ProjectQuickView({
  project,
  onClose,
}: { project: QuickProject | null; onClose: () => void }) {
  return (
    <Drawer open={!!project} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="sm:max-w-sm">
        {project ? <Body project={project} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

function Body({ project }: { project: QuickProject }) {
  return (
    <>
      <DrawerHeader className="flex flex-row items-start justify-between gap-2 border-b border-border">
        <div className="flex flex-col gap-1">
          <DrawerTitle>{project.name}</DrawerTitle>
          <DrawerDescription className="flex flex-wrap items-center gap-1.5">
            <Badge variant={STATUS_VARIANT[project.status]}>
              {STATUS_LABEL[project.status]}
            </Badge>
            <GitHubModeBadge mode={project.github_sync_mode ?? "none"} />
            <span className="text-[11px] tabular-nums">
              {relativeTime(project.updated_at)}
            </span>
          </DrawerDescription>
        </div>
        <DrawerClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </DrawerClose>
      </DrawerHeader>

      <div className="flex flex-col gap-6 overflow-y-auto p-4">
        <section className="flex flex-col gap-2.5 text-xs">
          <Heading>Detalles</Heading>
          <Row icon={<Building2 className="size-3.5" />}>{project.client_name}</Row>
          {project.github_repo ? (
            <Row icon={<ExternalLink className="size-3.5" />}>
              <a
                href={project.github_repo}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {project.github_repo.replace(/^https?:\/\//, "")}
              </a>
            </Row>
          ) : null}
          {project.description && (
            <div className="mt-2 rounded-md bg-muted/30 p-2 italic text-muted-foreground">
              {project.description}
            </div>
          )}
        </section>

        {/* Aquí se podrían añadir Tareas próximas, etc. */}
      </div>

      <div className="mt-auto border-t border-border p-3">
        <Button asChild className="w-full" size="sm" variant="outline">
          <Link href={`/projects/${project.id}`}>
            Ver detalle completo
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}
