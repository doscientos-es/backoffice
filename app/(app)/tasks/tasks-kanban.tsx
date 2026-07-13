"use client";

import { Badge } from "@/components/ui/badge";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { type TaskPriority as SharedTaskPriority, TASK_PRIORITY } from "@/lib/status";
import { cn, formatDate, relativeTime } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { AlertTriangle, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useOptimistic, useState, useTransition } from "react";
import { updateTaskStatus } from "./actions";
import { TaskCreateDialog } from "./task-create-dialog";

type TaskStatus = "todo" | "in_progress" | "in_review" | "done" | "cancelled";
type TaskPriority = SharedTaskPriority;

export type KanbanTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project: { id: string; name: string } | null;
  assignee_name: string | null;
};

const COLUMNS: { id: TaskStatus; label: string; tone: string; dot: string }[] = [
  { id: "todo", label: "Por hacer", tone: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  {
    id: "in_progress",
    label: "En curso",
    tone: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  {
    id: "in_review",
    label: "Revisión",
    tone: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    id: "done",
    label: "Terminada",
    tone: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    id: "cancelled",
    label: "Cancelada",
    tone: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
];

type Action = { id: string; status: TaskStatus };

function isOverdue(task: KanbanTask): boolean {
  if (!task.due_date) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.due_date).getTime() < Date.now();
}

interface TasksKanbanProps {
  tasks: KanbanTask[];
  capped?: boolean;
  projects?: Array<{ id: string; name: string }>;
  leads?: Array<{ id: string; name: string }>;
  members?: Array<{ id: string; name: string }>;
  currentUserId?: string;
}

export function TasksKanban({
  tasks,
  capped,
  projects = [],
  leads = [],
  members = [],
  currentUserId,
}: TasksKanbanProps) {
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(tasks, (state, { id, status }: Action) =>
    state.map((t) => (t.id === id ? { ...t, status } : t)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const feedback = useFormFeedback();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const to = String(e.over.id) as TaskStatus;
    const current = optimistic.find((t) => t.id === id);
    if (!current || current.status === to) return;

    startTransition(async () => {
      applyOptimistic({ id, status: to });
      feedback.setPending();
      const res = await updateTaskStatus({ taskId: id, status: to });
      if (!res.ok) feedback.setError(res.error);
      else feedback.setSuccess("Estado actualizado");
    });
  };

  const grouped: Record<TaskStatus, KanbanTask[]> = {
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
    cancelled: [],
  };
  for (const t of optimistic) grouped[t.status]?.push(t);

  const active = activeId ? optimistic.find((t) => t.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {capped ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          <TriangleAlert className="size-4 shrink-0" />
          <span>
            Se muestran las primeras <strong>200</strong> tareas. Usa los filtros para acotar los
            resultados.
          </span>
        </div>
      ) : null}
      <div className="flex justify-end pb-1 min-h-5">
        <FormFeedback state={feedback.state} pendingLabel="Actualizando…" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scroll-fade-x no-scrollbar">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            status={col.id}
            label={col.label}
            tone={col.tone}
            dot={col.dot}
            tasks={grouped[col.id]}
            addButton={
              col.id === "todo" ? (
                <TaskCreateDialog
                  projects={projects}
                  leads={leads}
                  members={members}
                  currentUserId={currentUserId}
                  trigger={
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Plus className="size-3.5" />
                      Añadir tarea
                    </button>
                  }
                />
              ) : undefined
            }
          />
        ))}
      </div>
      <DragOverlay>{active ? <TaskCard task={active} isOverlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  tone,
  dot,
  tasks,
  addButton,
}: {
  status: TaskStatus;
  label: string;
  tone: string;
  dot: string;
  tasks: KanbanTask[];
  addButton?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl bg-card ring-1 ring-foreground/10 transition-colors",
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full shrink-0", dot)} />
          <span className={cn("text-xs font-semibold tracking-wide", tone)}>{label}</span>
        </div>
        <Badge variant="neutral" className="tabular-nums text-[11px] h-5">
          {tasks.length}
        </Badge>
      </header>
      <div className="flex flex-col gap-1.5 p-2 min-h-24">
        {tasks.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Sin tareas</p>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} />)
        )}
        {addButton}
      </div>
    </div>
  );
}

function TaskCard({ task, isOverlay = false }: { task: KanbanTask; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const overdue = isOverdue(task);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-lg border border-border bg-background p-2.5 shadow-xs transition",
        "hover:border-foreground/20 hover:shadow-sm",
        isDragging && !isOverlay && "opacity-30",
        isOverlay && "rotate-2 cursor-grabbing shadow-lg ring-1 ring-primary/30",
        overdue && "ring-1 ring-red-400/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/tasks/${task.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
        >
          {task.title}
        </Link>
        <StatusBadge
          meta={TASK_PRIORITY}
          value={task.priority}
          className="text-[10px] h-4 px-1.5 shrink-0"
        />
      </div>

      {task.project ? (
        <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{task.project.name}</div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-muted-foreground">
          {task.assignee_name ?? "Sin asignar"}
        </span>
        {task.due_date ? (
          <span
            className={cn(
              "tabular-nums shrink-0 inline-flex items-center gap-1",
              overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground",
            )}
            title={overdue ? `Vencida hace ${relativeTime(task.due_date)}` : undefined}
          >
            {overdue ? <AlertTriangle className="size-3" /> : null}
            {formatDate(task.due_date)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
