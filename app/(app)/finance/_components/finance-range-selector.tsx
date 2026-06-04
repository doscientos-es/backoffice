"use client";

import { Select } from "@/components/ui/select";
import { type FinanceRange, FINANCE_RANGE_OPTIONS } from "@/lib/finance/range";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function FinanceRangeSelector({ current }: { current: FinanceRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const onSelect = (next: FinanceRange) => {
    const params = new URLSearchParams(searchParams.toString());
    // "month" is the default — omit the param to keep URLs clean
    if (next === "month") params.delete("range");
    else params.set("range", next);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  return (
    <div className={cn("flex items-center gap-2 text-xs", pending && "opacity-70")}>
      <span className="font-medium text-muted-foreground">Periodo</span>
      <Select
        aria-label="Rango temporal"
        value={current}
        onChange={(e) => onSelect(e.target.value as FinanceRange)}
        className="h-8 w-44 text-xs"
      >
        {FINANCE_RANGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
