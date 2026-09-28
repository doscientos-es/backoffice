"use client";

import { CheckCircle2, Phone, PhoneOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CallSessionStatus } from "@/lib/leads/call-session";
import { formatEUR } from "@/lib/utils";

type Completion = { durationMinutes: number; defaultOutcome: "connected" | "no_answer" };
type Action = "dial" | "finish";
type ActionResponse = { error?: string } & Partial<Completion>;
type CallBriefing = {
  name: string;
  company: string | null;
  leadStatus: string | null;
  estimatedValue: number | null;
  questions: Array<{ question: string; status: string }>;
  proposals: Array<{ title: string; status: string; total: number }>;
  invoiceCount: number;
  paidTotal: number;
  outstandingTotal: number;
};

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const plusIndex = cleaned.indexOf("+");
  return plusIndex > 0 ? cleaned.slice(plusIndex) : cleaned;
}

function actionErrorMessage(error?: string): string {
  switch (error) {
    case "session_changed":
      return "La llamada se actualizó desde otro dispositivo. Recarga la página para ver el estado actual.";
    case "session_closed":
      return "La llamada ya está cerrada. Recarga la página para ver el estado actual.";
    case "not_found":
      return "La sesión no existe o ha caducado.";
    case "rate_limited":
      return "Hay demasiados intentos. Espera un momento e inténtalo de nuevo.";
    default:
      return "No se pudo actualizar la llamada.";
  }
}

export function MobileCallSession({
  token,
  phone,
  status: initialStatus,
  briefing,
}: {
  token: string;
  phone: string;
  status: CallSessionStatus;
  briefing: CallBriefing;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);

  async function update(action: Action): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/call-sessions/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json().catch(() => ({}))) as ActionResponse;
      if (!response.ok) throw new Error(actionErrorMessage(result.error));
      if (action === "dial") setStatus("dialing");
      if (action === "finish" && result.durationMinutes !== undefined && result.defaultOutcome) {
        const next = {
          durationMinutes: result.durationMinutes,
          defaultOutcome: result.defaultOutcome,
        };
        setCompletion(next);
        setStatus("awaiting_log");
      }
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : actionErrorMessage());
      return false;
    } finally {
      setPending(false);
    }
  }

  async function startCall() {
    if (await update("dial")) window.location.assign(`tel:${normalizePhone(phone)}`);
  }

  async function finishCall() {
    await update("finish");
  }

  const canCall = status === "started" || status === "dialing";
  const closed = status === "logged";
  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-5 py-10 sm:py-16">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase dark:text-emerald-300">
          Llamada preparada
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Llama desde este móvil</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Al terminar, confirma el cierre aquí. El resultado se registrará en tu ordenador.
        </p>
      </div>
      <div className="rounded-xl border border-emerald-900/10 bg-white/70 p-5 text-center dark:border-emerald-200/10 dark:bg-white/4">
        <p className="font-mono text-lg font-semibold tracking-wide">{phone}</p>
      </div>
      <div className="rounded-xl border bg-card p-4 text-left shadow-sm">
        <h2 className="text-sm font-semibold">Información rápida</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-medium">{briefing.name}</p>
            {briefing.company && <p className="text-muted-foreground">{briefing.company}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {[
                briefing.leadStatus && `Estado: ${briefing.leadStatus}`,
                briefing.estimatedValue != null &&
                  `Valor estimado: ${formatEUR(briefing.estimatedValue)}`,
              ]
                .filter(Boolean)
                .join(" · ") || "Sin resumen comercial registrado"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-xs">
            <p>
              Facturas: <span className="font-semibold">{briefing.invoiceCount}</span>
            </p>
            <p>
              Pagado: <span className="font-semibold">{formatEUR(briefing.paidTotal)}</span>
            </p>
            <p className="col-span-2">
              Pendiente de cobro:{" "}
              <span className="font-semibold">{formatEUR(briefing.outstandingTotal)}</span>
            </p>
          </div>
          {briefing.proposals.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Propuestas
              </p>
              <ul className="space-y-1">
                {briefing.proposals.map((proposal, index) => (
                  <li key={`${proposal.title}-${index}`} className="flex justify-between gap-3">
                    <span className="truncate">
                      {proposal.title} · {proposal.status}
                    </span>
                    <span className="shrink-0 font-medium">{formatEUR(proposal.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Preguntas para la llamada
            </p>
            {briefing.questions.length ? (
              <ul className="list-disc space-y-1 pl-4">
                {briefing.questions.map((item, index) => (
                  <li key={`${item.question}-${index}`}>{item.question}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Aún no hay preguntas preparadas.</p>
            )}
          </div>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {completion || status === "logged" ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-50/70 p-4 text-sm text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-4" /> Llamada finalizada
          </div>
          <p className="mt-2">
            {completion ? `Duración estimada: ${completion.durationMinutes} min. ` : ""}Completa el
            resultado y las notas en el ordenador.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            onClick={startCall}
            disabled={pending || !canCall}
            className="gap-2"
          >
            <Phone className="size-4" /> Abrir teléfono
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={finishCall}
            disabled={pending || closed}
            className="gap-2"
          >
            <PhoneOff className="size-4" />{" "}
            {status === "awaiting_log" ? "Ver cierre" : "He terminado"}
          </Button>
        </div>
      )}
    </section>
  );
}
