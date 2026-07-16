"use client";

import { Button } from "@/components/ui/button";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type FilterOption = { value: string; label: string };

export type FilterConfig = {
  key: string;
  label: string;
  options: FilterOption[];
  searchable?: boolean;
};

export type ListControlsProps = {
  searchKey?: string;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  /** Override classes on the root container (e.g. to remove border-b). */
  className?: string;
  /** Si se provee, muestra un botón "Exportar CSV" que llama este callback. */
  onExport?: () => void;
};

function updateParams(
  current: URLSearchParams,
  updates: Record<string, string | null>,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
  }
  return next;
}

export function ListControls({
  searchKey = "q",
  searchPlaceholder = "Buscar…",
  filters = [],
  pagination,
  className,
  onExport,
}: ListControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const urlQ = params.get(searchKey) ?? "";
  const [q, setQ] = useState(urlQ);

  // Keep the latest router-related callbacks in a ref so the debounce effect
  // can depend only on `q` without re-creating the timeout on every render.
  const commitRef = useRef<(value: string) => void>(() => {});
  commitRef.current = (value: string) => {
    const next = updateParams(params, { [searchKey]: value, page: null });
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  // Sync local input when the URL changes externally (back/forward, links).
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  // Debounce input → URL.
  useEffect(() => {
    if (q === urlQ) return;
    const handle = setTimeout(() => commitRef.current(q), 250);
    return () => clearTimeout(handle);
  }, [q, urlQ]);

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = updateParams(params, { [key]: value || null, page: null });
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const setPage = useCallback(
    (page: number) => {
      const next = updateParams(params, { page: page <= 1 ? null : String(page) });
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const clearFilters = useCallback(() => {
    const keys = [searchKey, ...filters.map((filter) => filter.key), "page"];
    const next = new URLSearchParams(params.toString());
    for (const key of keys) next.delete(key);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, params, pathname, router, searchKey]);

  const hasActiveFilters =
    Boolean(params.get(searchKey)) || filters.some((filter) => Boolean(params.get(filter.key)));

  const hasControls = searchKey || filters.length > 0;
  const hasPagination =
    pagination && pagination.total > 0 && pagination.total > pagination.pageSize;

  if (!hasControls && !hasPagination) return null;

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;
  const from = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const to = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0;

  return (
    <div className={cn("flex flex-col border-b border-border", className)}>
      {/* ── Single row: search + filters + export + pagination ───────── */}
      {/* On large screens everything fits inline; on small it wraps.    */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        {searchKey ? (
          <div className="relative w-full min-w-32 flex-1 sm:max-w-56">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-7 text-sm"
            />
          </div>
        ) : null}

        {/* Filters inline with the search on large screens */}
        {filters.map((f) =>
          f.searchable ? (
            <EntityCombobox
              key={f.key}
              items={f.options.map((o) => ({ id: o.value, label: o.label }))}
              value={params.get(f.key) ?? ""}
              onChange={(value) => setFilter(f.key, value)}
              placeholder={`${f.label}: todos`}
              aria-label={f.label}
              className="h-8 min-w-30 max-w-45 flex-1 text-xs sm:flex-none"
            />
          ) : (
            <Select
              key={f.key}
              value={params.get(f.key) ?? ""}
              onChange={(e) => setFilter(f.key, e.target.value)}
              aria-label={f.label}
              className="h-8 min-w-30 max-w-45 flex-1 text-xs sm:flex-none"
            >
              <option value="">{f.label}: todos</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ),
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {hasActiveFilters ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="size-3.5" />
              Limpiar
            </Button>
          ) : null}
          {onExport ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onExport}
              aria-label="Exportar CSV"
              title="Exportar CSV"
            >
              <Download className="size-3.5" />
            </Button>
          ) : null}
          {pagination ? (
            <>
              <span className="text-xs tabular-nums text-muted-foreground">
                {pagination.total === 0 ? "Sin resultados" : `${from}–${to} de ${pagination.total}`}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pagination.page <= 1}
                onClick={() => setPage(pagination.page - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pagination.page >= totalPages}
                onClick={() => setPage(pagination.page + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
