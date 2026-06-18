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
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { computeHoursFromRange } from "@/lib/schemas/work-log";
import { PROJECT_STATUS, type ProjectStatus } from "@/lib/status";
import { relativeTime } from "@/lib/utils";
import { ArrowUpRight, Building2, Clock, ExternalLink, Trash2, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState, useTransition } from "react";
import { sileo } from "sileo";
import { addWorkLog } from "./[id]/work-log-actions";
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
  onDeleteAction,
  onCloseAction,
}: {
  project: QuickProject | null;
  canEdit?: boolean;
  /** Optimistically removes the project from the list and runs the delete. */
  onDeleteAction: (id: string) => void;
  onCloseAction: () => void;
}) {
  return (
    <Drawer open={!!project} onOpenChange={(v) => !v && onCloseAction()} direction="right">
      <DrawerContent className="sm:max-w-sm">
        {project ? (
          <ErrorBoundary>
            <Body project={project} canEdit={canEdit} onDeleteAction={onDeleteAction} />
          </ErrorBoundary>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

type BodyProps = { project: QuickProject; canEdit: boolean; onDeleteAction: (id: string) => void };

function Body({ project, canEdit, onDeleteAction }: BodyProps) {
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

        {canEdit && (
          <section className="flex flex-col gap-2.5">
            <Heading>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3" />
                Registrar horas
              </span>
            </Heading>
            <QuickAddHours projectId={project.id} />
          </section>
        )}
      </div>

      <footer className="mt-auto flex items-center gap-2 border-t border-border p-3">
        {canEdit && (
          <DeleteProjectButton
            projectId={project.id}
            projectName={project.name}
            onConfirmAction={onDeleteAction}
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

const todayISO = () => new Date().toISOString().slice(0, 10);

function QuickAddHours({ projectId }: { projectId: string }) {
  const [date, setDate] = useState(todayISO);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [adding, startAdd] = useTransition();

  const duration = start && end ? computeHoursFromRange(start, end) : null;

  function onAdd() {
    if (!start || !end) {
      sileo.error({ title: "Indica hora de inicio y fin." });
      return;
    }
    if (duration === null) {
      sileo.error({ title: "La hora de fin debe ser posterior a la de inicio." });
      return;
    }
    startAdd(async () => {
      const res = await addWorkLog({
        project_id: projectId,
        work_date: date,
        start_time: start,
        end_time: end,
        note,
      });
      if (!res.ok) {
        sileo.error({ title: res.error });
        return;
      }
      sileo.success({ title: "Horas registradas." });
      setStart("");
      setEnd("");
      setNote("");
    });
  }

  const hh = duration !== null ? Math.floor(Math.round(duration * 60) / 60) : null;
  const mm = duration !== null ? Math.round(duration * 60) % 60 : null;
  const durationLabel =
    duration !== null
      ? hh === 0
        ? `${mm} min`
        : mm === 0
          ? `${hh} h`
          : `${hh} h ${mm} min`
      : null;

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="date"
        value={date}
        max={todayISO()}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 text-xs"
        aria-label="Fecha"
      />
      <div className="flex items-center gap-1">
        <Input
          type="time"
          value={start}
          max={end || undefined}
          onChange={(e) => setStart(e.target.value)}
          className="h-8 flex-1 tabular-nums text-xs"
          aria-label="Hora de inicio"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="time"
          value={end}
          min={start || undefined}
          onChange={(e) => setEnd(e.target.value)}
          className="h-8 flex-1 tabular-nums text-xs"
          aria-label="Hora de fin"
        />
        {durationLabel && (
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {durationLabel}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          maxLength={500}
          className="h-8 flex-1 text-xs"
          aria-label="Nota"
        />
        <Button size="sm" onClick={onAdd} disabled={adding || !start || !end}>
          Añadir
        </Button>
      </div>
    </div>
  );
}

function DeleteProjectButton({
  projectId,
  projectName,
  onConfirmAction,
}: {
  projectId: string;
  projectName: string;
  /** Triggers the optimistic removal + delete in the parent list. */
  onConfirmAction: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  function onConfirm() {
    setOpen(false);
    onConfirmAction(projectId);
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
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Eliminar
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
