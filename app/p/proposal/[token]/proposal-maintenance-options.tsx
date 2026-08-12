"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormFeedback, useFormFeedback } from "@/components/ui/form-feedback";
import type { MaintenanceOffer } from "@/lib/proposals/maintenance";
import { formatEUR } from "@/lib/utils";
import { selectProposalMaintenance } from "./actions";

export function ProposalMaintenanceOptions({
  token,
  offer,
  selectedPlanId,
  disabled,
}: {
  token: string;
  offer: MaintenanceOffer;
  selectedPlanId: string | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const feedback = useFormFeedback({ successResetMs: 0 });
  const [selected, setSelected] = useState(selectedPlanId);

  const choose = async (planId: string | null) => {
    if (disabled) return;
    feedback.setPending();
    const result = await selectProposalMaintenance(token, planId);
    if (!result.ok) return feedback.setError(result.error);
    setSelected(planId);
    feedback.setSuccess(planId ? "Mantenimiento seleccionado" : "Mantenimiento no añadido");
    router.refresh();
  };

  return (
    <section className="border-b border-zinc-100 px-8 py-7 dark:border-zinc-800/60">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
        {offer.heading}
      </p>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{offer.intro}</p>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {offer.plans.map((plan) => {
          const active = selected === plan.id;
          return (
            <article
              key={plan.id}
              className={`rounded-lg border p-4 ${active ? "border-[#2A4227] bg-[#2A4227]/5 dark:border-[#9CC196]" : "border-zinc-200 dark:border-zinc-800"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</h2>
                  <p className="mt-1 text-lg font-bold text-[#2A4227] dark:text-[#9CC196]">
                    {formatEUR(plan.monthly_price)} <span className="text-xs font-medium">/ mes + IVA</span>
                  </p>
                </div>
                {active ? <Check className="size-5 text-[#2A4227] dark:text-[#9CC196]" /> : null}
              </div>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{plan.summary}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                {plan.coverage.map((item) => (
                  <li key={item} className="flex gap-2"><span aria-hidden>•</span><span>{item}</span></li>
                ))}
              </ul>
              {!disabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "outline"}
                  className="mt-4 w-full"
                  disabled={feedback.pending}
                  onClick={() => choose(active ? null : plan.id)}
                >
                  {active ? "Quitar mantenimiento" : "Elegir este plan"}
                </Button>
              ) : null}
            </article>
          );
        })}
      </div>
      {!disabled ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <FormFeedback state={feedback.state} pendingLabel="Actualizando propuesta…" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Es opcional. Puedes aceptar la propuesta sin seleccionar mantenimiento.
          </p>
        </div>
      ) : null}
    </section>
  );
}