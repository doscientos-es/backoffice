"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MaintenanceOffer } from "@/lib/proposals/maintenance";
import { formatEUR } from "@/lib/utils";

type Props = {
  offer: MaintenanceOffer;
  selectedPlanId: string | null;
  onChange: (offer: MaintenanceOffer) => void;
  onSelectedPlanChange: (planId: string | null) => void;
  locked: boolean;
};

function coverageLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Proposal-scoped maintenance plans. Copy and pricing remain editable per quote. */
export function MaintenanceOfferEditor({
  offer,
  selectedPlanId,
  onChange,
  onSelectedPlanChange,
  locked,
}: Props) {
  const patchPlan = (index: number, patch: Partial<MaintenanceOffer["plans"][number]>) => {
    onChange({
      ...offer,
      plans: offer.plans.map((plan, current) => (current === index ? { ...plan, ...patch } : plan)),
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">Mantenimiento opcional</h2>
        <p className="text-[11px] text-muted-foreground">
          Personaliza los planes para esta propuesta. El cliente podrá escoger uno antes de
          aceptarla.
        </p>
      </header>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Input
          value={offer.heading}
          onChange={(event) => onChange({ ...offer, heading: event.target.value })}
          disabled={locked}
          aria-label="Título de mantenimiento"
        />
        <Textarea
          value={offer.intro}
          onChange={(event) => onChange({ ...offer, intro: event.target.value })}
          disabled={locked}
          rows={2}
          aria-label="Introducción de mantenimiento"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {offer.plans.map((plan, index) => {
          const selected = selectedPlanId === plan.id;
          return (
            <article
              key={plan.id}
              className={`flex flex-col gap-3 rounded-lg border p-3 ${selected ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Plan {index + 1}
                </span>
                {selected ? (
                  <Check className="size-4 text-primary" aria-label="Seleccionado" />
                ) : null}
              </div>
              <Input
                value={plan.name}
                onChange={(event) => patchPlan(index, { name: event.target.value })}
                disabled={locked}
                aria-label={`Nombre del plan ${index + 1}`}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={plan.monthly_price}
                  onChange={(event) =>
                    patchPlan(index, { monthly_price: Number(event.target.value) || 0 })
                  }
                  disabled={locked}
                  aria-label={`Precio mensual del plan ${plan.name}`}
                />
                <span className="shrink-0 text-xs text-muted-foreground">€/mes + IVA</span>
              </div>
              <Textarea
                value={plan.summary}
                onChange={(event) => patchPlan(index, { summary: event.target.value })}
                disabled={locked}
                rows={3}
                aria-label={`Resumen del plan ${plan.name}`}
              />
              <Textarea
                value={plan.coverage.join("\n")}
                onChange={(event) =>
                  patchPlan(index, { coverage: coverageLines(event.target.value) })
                }
                disabled={locked}
                rows={6}
                placeholder="Una cobertura por línea"
                aria-label={`Coberturas del plan ${plan.name}`}
              />
              <Button
                type="button"
                size="sm"
                variant={selected ? "secondary" : "outline"}
                disabled={locked}
                onClick={() => onSelectedPlanChange(selected ? null : plan.id)}
              >
                {selected
                  ? "Quitar de la propuesta"
                  : `Seleccionar · ${formatEUR(plan.monthly_price)}/mes`}
              </Button>
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedPlanId
          ? "Este plan queda incluido como cuota mensual y se podrá cambiar hasta que la propuesta sea aceptada."
          : "No se ha seleccionado ningún plan. La propuesta seguirá siendo válida sin mantenimiento."}
      </p>
    </section>
  );
}
