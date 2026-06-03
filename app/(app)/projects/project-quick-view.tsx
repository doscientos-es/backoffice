"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { StatusBadge } from "@/components/ui/status-badge";
import { PROJECT_STATUS, type ProjectStatus } from "@/lib/status";
import { relativeTime } from "@/lib/utils";
import { ArrowUpRight, Building2, ExternalLink, Trash2, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState, useTransition } from "react";
import { deleteProject } from "./actions";
import { GitHubModeBadge } from "./github-mode-badge";
import type { GitHubSyncMode } from "./github-sync-section";

export type QuickProject = {
  id: string;
  name: string;
  client_name: string;
  status: ProjectStatus;
  description: string | null;
  updated_at: string;
  github_sync_mode?: GitHubSyncMode | null;
  github_repo?: string | null;
};

export function ProjectQuickView({
  project,
  canEdit = false,
  onCloseAction,
}: { project: QuickProject | null; canEdit?: boolean; onCloseAction: () => void }) {
  return (
    <Drawer open={!!project} onOpenChange={(v) => !v && onCloseAction()} direction="right">
      <DrawerContent className="sm:max-w-sm">
        {project ? (
          <ErrorBoundary>
            <Body project={project} canEdit={canEdit} onCloseAction={onCloseAction} />
          </ErrorBoundary>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

type BodyProps = { project: QuickProject; canEdit: boolean; onCloseAction: () => void };

function Body({ project, canEdit, onCloseAction }: BodyProps) {
  return (
    <>
      <DrawerHeader className="flex flex-row items-start justify-between gap-2 border-b border-border">
        <div className="flex flex-col gap-1">
          <DrawerTitle>{project.name}</DrawerTitle>
          <DrawerDescription className="flex flex-wrap items-center gap-1.5">
            <StatusBadge meta={PROJECT_STATUS} value={project.status} />
            <GitHubModeBadge mode={project.github_sync_mode ?? "none"} />
            <span className="text-[11px] tabular-nums">{relativeTime(project.updated_at)}</span>
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

      <footer className="mt-auto flex items-center gap-2 border-t border-border p-3">
        {canEdit && (
          <DeleteProjectButton
            projectId={project.id}
            projectName={project.name}
            onDeleted={onCloseAction}
          />
        )}
        <Button asChild className="flex-1" size="sm" variant="outline">
          <Link href={`/projects/${project.id}`}>
            Ver detalle completo
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </footer>
    </>
  );
}

function DeleteProjectButton({
  projectId,
  projectName,
  onDeleted,
}: {
  projectId: string;
  projectName: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      await deleteProject({ id: projectId });
      setOpen(false);
      onDeleted();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Eliminar proyecto"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar proyecto</DialogTitle>
          <DialogDescription>
            ¿Eliminar <strong>{projectName}</strong>? Podrás restaurarlo desde la base de datos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={pending}>
            {pending ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
