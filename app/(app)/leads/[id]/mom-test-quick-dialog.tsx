"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { updateLeadMomTestSignal } from "../actions";
import type { MomTestValues } from "./mom-test-checklist";

const SIGNALS = [
  { key: "real_problem", label: "Problema real" },
  { key: "aware_problem", label: "Es consciente" },
  { key: "tried_solutions", label: "Ha probado soluciones" },
  { key: "decision_power_or_budget", label: "Decide o tiene presupuesto" },
  { key: "accessible", label: "Es accesible" },
] as const;

const EMPTY_VALUES: MomTestValues = {
  real_problem: null,
  aware_problem: null,
  tried_solutions: null,
  decision_power_or_budget: null,
  accessible: null,
};

export function MomTestQuickDialog({
  leadId,
  open,
  onOpenChange,
  accessible,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessible: boolean | null;
}) {
  const [values, setValues] = useState<MomTestValues>(EMPTY_VALUES);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) setValues({ ...EMPTY_VALUES, accessible });
  }, [accessible, open]);

  function setSignal(key: keyof MomTestValues, next: boolean | null) {
    const previous = values[key];
    setValues((current) => ({ ...current, [key]: next }));
    startTransition(async () => {
      const result = await updateLeadMomTestSignal({ leadId, signal: key, value: next });
      if (!result.ok) {
        setValues((current) => ({ ...current, [key]: previous }));
        sileo.error({ title: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mom Test rápido</DialogTitle>
          <DialogDescription>
            Marca solo lo que hayas confirmado durante la primera conversación. Se guarda al pulsar.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3">
          {SIGNALS.map((signal) => {
            const value = values[signal.key];
            return (
              <li key={signal.key} className="flex items-center justify-between gap-3">
                <span className="text-sm">{signal.label}</span>
                <ButtonGroup>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    className={cn(
                      value === true &&
                        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                    )}
                    aria-pressed={value === true}
                    onClick={() => setSignal(signal.key, value === true ? null : true)}
                  >
                    <Check className="size-3.5" />
                    Sí
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={value === false ? "destructive" : "outline"}
                    disabled={pending}
                    aria-pressed={value === false}
                    onClick={() => setSignal(signal.key, value === false ? null : false)}
                  >
                    <X className="size-3.5" />
                    No
                  </Button>
                </ButtonGroup>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
