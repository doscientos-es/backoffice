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

function listLines(value: string): string[] {
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
      <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Título para el cliente</span>
          <Input
            value={offer.heading}
            onChange={(event) => onChange({ ...offer, heading: event.target.value })}
            disabled={locked}
            aria-label="Título de mantenimiento"
            className="bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Mensaje de introducción</span>
          <Textarea
            value={offer.intro}
            onChange={(event) => onChange({ ...offer, intro: event.target.value })}
            disabled={locked}
            rows={2}
            aria-label="Introducción de mantenimiento"
            className="min-h-20 resize-y bg-background text-sm"
          />
        </div>
      </div>
      <div className="grid gap-4 2xl:grid-cols-3">
        {offer.plans.map((plan, index) => {
          const selected = selectedPlanId === plan.id;
          return (
            <article
              key={plan.id}
              className={`flex flex-col gap-4 rounded-lg border p-4 ${selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Plan {index + 1}
                </span>
                {selected ? (
                  <Check className="size-4 text-primary" aria-label="Seleccionado" />
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  <span>Nombre del plan</span>
                  <Input
                    value={plan.name}
                    onChange={(event) => patchPlan(index, { name: event.target.value })}
                    disabled={locked}
                    aria-label={`Nombre del plan ${index + 1}`}
                  />
                </div>
                <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  <span>Cuota mensual</span>
                  <div className="flex items-center gap-1.5">
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
                    <span className="shrink-0 text-xs text-muted-foreground">€</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                <span>Resumen</span>
                <Textarea
                  value={plan.summary}
                  onChange={(event) => patchPlan(index, { summary: event.target.value })}
                  disabled={locked}
                  rows={2}
                  aria-label={`Resumen del plan ${plan.name}`}
                  className="min-h-20 resize-y text-sm"
                />
              </div>
              <div className="grid gap-3">
                <div className="flex flex-col gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <span>Incluye</span>
                  <Textarea
                    value={plan.coverage.join("\n")}
                    onChange={(event) =>
                      patchPlan(index, { coverage: listLines(event.target.value) })
                    }
                    disabled={locked}
                    rows={5}
                    placeholder="Un concepto por línea"
                    aria-label={`Coberturas del plan ${plan.name}`}
                    className="min-h-28 resize-y bg-emerald-500/5 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  <span>No incluye</span>
                  <Textarea
                    value={plan.exclusions.join("\n")}
                    onChange={(event) =>
                      patchPlan(index, { exclusions: listLines(event.target.value) })
                    }
                    disabled={locked}
                    rows={4}
                    placeholder="Una exclusión por línea"
                    aria-label={`Exclusiones del plan ${plan.name}`}
                    className="min-h-24 resize-y bg-muted/30 text-sm"
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={selected ? "secondary" : "outline"}
                className="mt-auto w-full"
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
