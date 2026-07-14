"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { updateLeadMomTestSignal } from "../actions";

const SIGNALS = [
  { key: "aware_problem", label: "Sabe que tiene el problema" },
  { key: "searched_solutions", label: "Ha buscado soluciones" },
  { key: "has_budget", label: "Tiene presupuesto" },
  { key: "knows_budget", label: "Conoce el presupuesto" },
  { key: "tried_solutions", label: "Ha probado otras cosas" },
] as const;

type SignalKey = (typeof SIGNALS)[number]["key"];
export type MomTestValues = Record<SignalKey, boolean | null>;

/**
 * Checklist tri-estado (vacío / sí / no) con las 5 señales del Mom Test que
 * ayudan a detectar un buen lead. Cada fila persiste al instante vía
 * `updateLeadMomTestSignal`, con revert optimista si falla. Clicar el valor
 * ya activo lo vuelve a vaciar.
 */
export function MomTestChecklist({
  leadId,
  initialValues,
  canEdit,
}: {
  leadId: string;
  initialValues: MomTestValues;
  canEdit: boolean;
}) {
  const [values, setValues] = useState(initialValues);
  const [, startTransition] = useTransition();

  const score = SIGNALS.filter((s) => values[s.key] === true).length;

  function setSignal(key: SignalKey, next: boolean | null) {
    const prev = values[key];
    setValues((v) => ({ ...v, [key]: next }));
    startTransition(async () => {
      const res = await updateLeadMomTestSignal({ leadId, signal: key, value: next });
      if (!res.ok) {
        setValues((v) => ({ ...v, [key]: prev }));
        sileo.error({ title: res.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Señales de un buen lead</p>
        <Badge variant={score >= 4 ? "success" : score >= 2 ? "warning" : "neutral"}>
          {score}/5
        </Badge>
      </div>
      <ul className="flex flex-col gap-2.5">
        {SIGNALS.map((s) => {
          const value = values[s.key];
          return (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{s.label}</span>
              {canEdit ? (
                <ButtonGroup>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      value === true &&
                        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                    )}
                    aria-pressed={value === true}
                    onClick={() => setSignal(s.key, value === true ? null : true)}
                  >
                    <Check className="size-3.5" />
                    Sí
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={value === false ? "destructive" : "outline"}
                    aria-pressed={value === false}
                    onClick={() => setSignal(s.key, value === false ? null : false)}
                  >
                    <X className="size-3.5" />
                    No
                  </Button>
                </ButtonGroup>
              ) : (
                <Badge
                  variant={value === true ? "success" : value === false ? "destructive" : "neutral"}
                >
                  {value === true ? "Sí" : value === false ? "No" : "Sin marcar"}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
