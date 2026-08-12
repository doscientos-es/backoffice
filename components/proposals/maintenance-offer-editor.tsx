"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAINTENANCE_LIMITS, type MaintenanceOffer } from "@/lib/proposals/maintenance";
import { formatEUR } from "@/lib/utils";

type Props = {
  offer: MaintenanceOffer;
  selectedPlanId: string | null;
  onChange: (offer: MaintenanceOffer) => void;
  onSelectedPlanChange: (planId: string | null) => void;
  locked: boolean;
};

function listLines(value: string, maxItems: number): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|[0-9]+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function MaintenanceListTextarea({
  items,
  onChange,
  disabled,
  maxItems,
  label,
  ariaLabel,
  placeholder,
  className,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  disabled: boolean;
  maxItems: number;
  label: string;
  ariaLabel: string;
  placeholder: string;
  className: string;
}) {
  const [draft, setDraft] = useState(() => items.join("\n"));
  const editing = useRef(false);
  const count = listLines(draft, maxItems).length;

  useEffect(() => {
    const nextDraft = items.join("\n");
    if (!editing.current && draft !== nextDraft) setDraft(nextDraft);
  }, [draft, items]);

  const commit = () => {
    editing.current = false;
    const nextItems = listLines(draft, maxItems);
    setDraft(nextItems.join("\n"));
    onChange(nextItems);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="text-[11px] font-normal tabular-nums text-muted-foreground">
          {count}/{maxItems}
        </span>
      </div>
      <Textarea
        value={draft}
        onChange={(event) => {
          editing.current = true;
          setDraft(event.target.value);
        }}
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={commit}
        disabled={disabled}
        rows={5}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
      />
      <p className="text-[11px] font-normal text-muted-foreground">
        Un punto por línea. Puedes pegar una lista con viñetas.
      </p>
    </>
  );
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
      <div className="flex flex-col gap-4">
        {offer.plans.map((plan, index) => {
          const selected = selectedPlanId === plan.id;
          return (
            <article
              key={plan.id}
              className={`overflow-hidden rounded-xl border ${selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background"}`}
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-background text-xs font-semibold tabular-nums text-muted-foreground shadow-sm">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Plan de mantenimiento</p>
                    <p className="text-[11px] text-muted-foreground">
                      Personaliza la cuota y las condiciones incluidas.
                    </p>
                  </div>
                </div>
                {selected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Check className="size-3.5" aria-hidden /> Seleccionado
                  </span>
                ) : null}
              </header>
              <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                      <span>Nombre del plan</span>
                      <Input
                        value={plan.name}
                        onChange={(event) => patchPlan(index, { name: event.target.value })}
                        disabled={locked}
                        aria-label={`Nombre del plan ${index + 1}`}
                        className="bg-background"
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
                          className="bg-background"
                        />
                        <span className="shrink-0 text-xs text-muted-foreground">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                    <span>Resumen para el cliente</span>
                    <Textarea
                      value={plan.summary}
                      onChange={(event) => patchPlan(index, { summary: event.target.value })}
                      disabled={locked}
                      rows={4}
                      aria-label={`Resumen del plan ${plan.name}`}
                      className="min-h-28 flex-1 resize-y bg-background text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="flex flex-col gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <MaintenanceListTextarea
                      items={plan.coverage}
                      onChange={(coverage) => patchPlan(index, { coverage })}
                      disabled={locked}
                      maxItems={MAINTENANCE_LIMITS.maxCoverageItems}
                      label="Incluye"
                      ariaLabel={`Coberturas del plan ${plan.name}`}
                      placeholder="Un concepto por línea"
                      className="min-h-32 resize-y border-emerald-500/20 bg-background text-sm"
                    />
                  </section>
                  <section className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-3 text-xs font-medium text-muted-foreground">
                    <MaintenanceListTextarea
                      items={plan.exclusions}
                      onChange={(exclusions) => patchPlan(index, { exclusions })}
                      disabled={locked}
                      maxItems={MAINTENANCE_LIMITS.maxExclusionItems}
                      label="No incluye"
                      ariaLabel={`Exclusiones del plan ${plan.name}`}
                      placeholder="Una exclusión por línea"
                      className="min-h-32 resize-y bg-background text-sm"
                    />
                  </section>
                </div>
              </div>
              <footer className="flex justify-end border-t border-border bg-muted/20 px-4 py-3">
                <Button
                  type="button"
                  size="sm"
                  variant={selected ? "secondary" : "outline"}
                  className="w-full sm:w-auto"
                  disabled={locked}
                  onClick={() => onSelectedPlanChange(selected ? null : plan.id)}
                >
                  {selected
                    ? "Quitar de la propuesta"
                    : `Seleccionar · ${formatEUR(plan.monthly_price)}/mes`}
                </Button>
              </footer>
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
