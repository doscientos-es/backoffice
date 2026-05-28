"use client";

import { type MarketingRange, RANGE_OPTIONS } from "@/lib/marketing/range";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function MarketingRangeSelector({ current }: { current: MarketingRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const onSelect = (next: MarketingRange) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "30d") params.delete("range");
    else params.set("range", next);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  return (
    <div
      role="tablist"
      aria-label="Rango temporal"
      className={cn(
        "inline-flex h-8 items-center rounded-lg border bg-card p-0.5 text-xs",
        pending && "opacity-70",
      )}
    >
      {RANGE_OPTIONS.map((opt) => {
        const active = opt.value === current;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(opt.value)}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.short}
          </button>
        );
      })}
    </div>
  );
}
