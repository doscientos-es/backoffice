"use client";

import {
  Check as Check,
  Clipboard as ClipboardList,
  LoaderCircle as Loader2,
  Sparkle as Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createTask } from "../tasks/actions";
import { EmailComposer } from "./[id]/email-composer";

type Props = {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  aiEnabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftKey: number;
};

/**
 * Follow-up composer shown after a call is logged. Nothing is sent until the
 * operator reviews and submits the email from the shared composer.
 */
export function CallDigestDialog({
  leadId,
  leadName,
  leadEmail,
  aiEnabled,
  open,
  onOpenChange,
  draftKey,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar resumen de la llamada</DialogTitle>
          <DialogDescription>
            La llamada con {leadName} se ha registrado. Revisa el borrador antes de enviarlo.
          </DialogDescription>
        </DialogHeader>
        {aiEnabled ? <CallCopilot key={draftKey} leadId={leadId} open={open} /> : null}
        <EmailComposer
          key={draftKey}
          leadId={leadId}
          defaultTo={leadEmail ?? ""}
          defaultSubject="Resumen de nuestra llamada · {{nombre}}"
          disabled={!leadEmail}
          disabledReason="Este lead no tiene email registrado. Puedes añadirlo desde la ficha del lead."
          aiEnabled={aiEnabled}
          draftKind="call_digest"
          draftInstructions="Redacta un resumen posterior a la llamada. Incluye los temas tratados, acuerdos y próximos pasos que aparezcan en las notas o transcripción. No menciones notas internas, IA ni la transcripción como tal y no inventes información. Tono profesional, cercano y accionable."
          ccAdmins
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type SuggestedTask = {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
};

type CopilotResult = {
  summary: string;
  decisions: string[];
  open_questions: string[];
  tasks: SuggestedTask[];
  follow_up_focus: string;
};

function CallCopilot({ leadId, open }: { leadId: string; open: boolean }) {
  const [data, setData] = useState<CopilotResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function generate() {
      setLoading(true);
      setError(null);
      setData(null);
      setApplied(false);
      try {
        const response = await fetch("/api/crm/ai/call-copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId }),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "No se pudo analizar la llamada.");
        if (cancelled) return;
        setData(json);
        setSelected((json.tasks as SuggestedTask[]).map((task) => task.title));
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Error desconocido.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void generate();
    return () => {
      cancelled = true;
    };
  }, [leadId, open]);

  async function applyTasks() {
    if (!data || selected.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      await Promise.all(
        data.tasks
          .filter((task) => selected.includes(task.title))
          .map((task) =>
            createTask({
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: "todo",
              lead_id: leadId,
              project_id: "",
              client_id: "",
              member_ids: [],
              due_date: "",
            }),
          ),
      );
      setApplied(true);
      setSelected([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron crear las tareas.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="rounded-lg border border-primary/15 bg-primary/[0.03] p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-3.5" />
        </span>
        <div>
          <p className="text-sm font-medium">Copiloto de llamada</p>
          <p className="text-xs text-muted-foreground">
            Propuesta basada en las notas y transcripción registradas.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Identificando acuerdos y próximos pasos…
        </div>
      ) : null}
      {data ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="leading-relaxed">{data.summary}</p>
          {data.decisions.length > 0 ? (
            <InsightList title="Acuerdos" items={data.decisions} />
          ) : null}
          {data.open_questions.length > 0 ? (
            <InsightList title="Por confirmar" items={data.open_questions} muted />
          ) : null}
          {data.tasks.length > 0 ? (
            <div className="rounded-md border bg-background/70 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <ClipboardList className="size-3.5" /> Acciones sugeridas
                </p>
                <span className="text-xs text-muted-foreground">
                  {selected.length}/{data.tasks.length} seleccionadas
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {data.tasks.map((task, index) => {
                  const checked = selected.includes(task.title);
                  return (
                    <label
                      key={task.title}
                      htmlFor={`call-task-${index}`}
                      className="flex cursor-pointer items-start gap-2 rounded p-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`call-task-${index}`}
                        checked={checked}
                        onCheckedChange={(value) =>
                          setSelected((current) =>
                            value === true
                              ? [...current, task.title]
                              : current.filter((title) => title !== task.title),
                          )
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-sm">{task.title}</span>
                        {task.description ? (
                          <span className="block text-xs text-muted-foreground">
                            {task.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={applying || selected.length === 0 || applied}
                  onClick={applyTasks}
                >
                  {applied ? <Check className="size-3.5 text-emerald-600" /> : null}
                  {applying ? "Creando…" : applied ? "Tareas creadas" : "Crear seleccionadas"}
                </Button>
              </div>
            </div>
          ) : null}
          {data.follow_up_focus ? (
            <p className="text-xs text-muted-foreground">
              El email de abajo se puede orientar a: {data.follow_up_focus}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className={cn("mt-2 text-xs text-destructive", loading && "hidden")}>{error}</p>
      ) : null}
    </section>
  );
}

function InsightList({
  title,
  items,
  muted = false,
}: {
  title: string;
  items: string[];
  muted?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className={cn("space-y-1 pl-4 text-xs", muted && "text-muted-foreground")}>
        {items.map((item) => (
          <li key={item} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
