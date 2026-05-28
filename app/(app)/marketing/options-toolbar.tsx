"use client";

import { Select } from "@/components/ui/select";
import { type MarketingSort, SORT_OPTIONS } from "@/lib/marketing/range";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Props = {
  sort: MarketingSort;
  showPaused: boolean;
  /** When true, hides the "incluir pausados" checkbox (campaign view doesn't use it). */
  hidePaused?: boolean;
};

export function OptionsToolbar({ sort, showPaused, hidePaused = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 text-xs",
        pending && "opacity-70",
      )}
    >
      <label className="flex items-center gap-2 text-muted-foreground">
        <span className="font-medium">Ordenar por</span>
        <Select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value === "spend_desc" ? null : e.target.value)}
          className="h-8 w-44 text-xs"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </label>

      {!hidePaused && (
        <label className="flex cursor-pointer items-center gap-2 text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={showPaused}
            onChange={(e) => updateParam("paused", e.target.checked ? "1" : null)}
            className="size-4 rounded border-[color:var(--border-strong)] accent-foreground"
          />
          <span className="font-medium">Incluir pausados</span>
        </label>
      )}
    </div>
  );
}
