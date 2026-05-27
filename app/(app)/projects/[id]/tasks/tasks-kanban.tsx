"use client";

import { Badge } from "@/components/ui/badge";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { TASK_PRIORITY, type TaskPriority } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { moveTask } from "../../../tasks/actions";

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done" | "cancelled";

export type KanbanTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee: { id: string; name: string } | null;
  kanban_order: string;
};

const COLUMNS: { id: TaskStatus; label: string; tone: string }[] = [
  { id: "todo", label: "Por hacer", tone: "text-muted-foreground" },
  { id: "in_progress", label: "En curso", tone: "text-sky-700 dark:text-sky-300" },
  { id: "in_review", label: "Revisión", tone: "text-amber-700 dark:text-amber-300" },
  { id: "done", label: "Terminada", tone: "text-emerald-700 dark:text-emerald-300" },
  { id: "cancelled", label: "Cancelada", tone: "text-red-700 dark:text-red-300" },
];

type Move = {
  taskId: string;
  toStatus: TaskStatus;
  beforeId: string | null;
  afterId: string | null;
};

function sortByOrder(a: KanbanTask, b: KanbanTask) {
  if (a.kanban_order < b.kanban_order) return -1;
  if (a.kanban_order > b.kanban_order) return 1;
  return 0;
}

function group(tasks: KanbanTask[]): Record<TaskStatus, KanbanTask[]> {
  const g: Record<TaskStatus, KanbanTask[]> = {
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
    cancelled: [],
  };
  for (const t of tasks) g[t.status]?.push(t);
  for (const k of Object.keys(g) as TaskStatus[]) g[k].sort(sortByOrder);
  return g;
}

function applyMove(state: KanbanTask[], move: Move): KanbanTask[] {
  const moved = state.find((t) => t.id === move.taskId);
  if (!moved) return state;
  // Build new order in target column by computing a midpoint string locally.
  // We don't recompute the exact rank — we just place it between neighbors using
  // a synthetic key that preserves ordering until the server returns the real one.
  const targetCol = state
    .filter((t) => t.status === move.toStatus && t.id !== move.taskId)
    .sort(sortByOrder);
  const beforeIdx = move.beforeId ? targetCol.findIndex((t) => t.id === move.beforeId) : -1;
  const afterIdx = move.afterId ? targetCol.findIndex((t) => t.id === move.afterId) : -1;
  const beforeOrder = beforeIdx >= 0 ? (targetCol[beforeIdx]?.kanban_order ?? null) : null;
  const afterOrder = afterIdx >= 0 ? (targetCol[afterIdx]?.kanban_order ?? null) : null;
  const synthetic = `${beforeOrder ?? "a"}~${afterOrder ?? "z"}`;
  return state.map((t) =>
    t.id === move.taskId ? { ...t, status: move.toStatus, kanban_order: synthetic } : t,
  );
}

export function TasksKanban({ tasks }: { tasks: KanbanTask[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(tasks, applyMove);
  const [activeId, setActiveId] = useState<string | null>(null);
  const feedback = useFormFeedback();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const grouped = group(optimistic);
  const active = activeId ? optimistic.find((t) => t.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active: a, over } = e;
    if (!over) return;
    const taskId = String(a.id);
    const overId = String(over.id);
    const task = optimistic.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target column and neighbors.
    let toStatus: TaskStatus;
    let beforeId: string | null = null;
    let afterId: string | null = null;
    const colIds = COLUMNS.map((c) => c.id as string);
    if (colIds.includes(overId)) {
      toStatus = overId as TaskStatus;
      const col = grouped[toStatus].filter((t) => t.id !== taskId);
      beforeId = col[col.length - 1]?.id ?? null;
    } else {
      const overTask = optimistic.find((t) => t.id === overId);
      if (!overTask) return;
      toStatus = overTask.status;
      const col = grouped[toStatus].filter((t) => t.id !== taskId);
      const idx = col.findIndex((t) => t.id === overId);
      beforeId = idx > 0 ? (col[idx - 1]?.id ?? null) : null;
      afterId = col[idx]?.id ?? null;
    }
    if (toStatus === task.status && beforeId === null && afterId === null) return;

    startTransition(async () => {
      applyOptimistic({ taskId, toStatus, beforeId, afterId });
      feedback.setPending();
      const res = await moveTask({ taskId, status: toStatus, beforeId, afterId });
      if (!res.ok) feedback.setError(res.error);
      else feedback.setSuccess("Movida");
    });
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex justify-end pb-1 min-h-5">
        <FormFeedback state={feedback.state} pendingLabel="Actualizando…" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((c) => (
          <Column key={c.id} status={c.id} label={c.label} tone={c.tone} tasks={grouped[c.id]} />
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
  tasks,
}: { status: TaskStatus; label: string; tone: string; tasks: KanbanTask[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl bg-card ring-1 ring-foreground/10 transition-colors",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className={cn("text-xs font-semibold uppercase tracking-wide", tone)}>{label}</span>
        <Badge variant="neutral" className="tabular-nums">
          {tasks.length}
        </Badge>
      </header>
      <div className="flex flex-col gap-2 p-2 min-h-24">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">Sin tareas.</p>
          ) : (
            tasks.map((t) => <SortableCard key={t.id} task={t} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableCard({ task }: { task: KanbanTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-lg bg-background ring-1 ring-border transition-shadow hover:ring-foreground/20",
        isDragging && "opacity-30",
      )}
    >
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, isOverlay = false }: { task: KanbanTask; isOverlay?: boolean }) {
  return (
    <div
      className={cn(
        "flex cursor-grab flex-col gap-1.5 p-2.5 text-left",
        isOverlay && "cursor-grabbing rounded-lg bg-background shadow-lg ring-1 ring-foreground/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/tasks/${task.id}`}
          className="truncate text-sm font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        >
          {task.title}
        </Link>
        <StatusBadge meta={TASK_PRIORITY} value={task.priority} className="shrink-0" />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{task.assignee?.name ?? "Sin asignar"}</span>
        {task.due_date ? <span className="tabular-nums">{task.due_date}</span> : null}
      </div>
    </div>
  );
}
