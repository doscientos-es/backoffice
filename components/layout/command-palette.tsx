"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { SearchResultItem } from "@/app/api/search/route";
import {
  CheckSquare,
  FileSignature,
  FolderKanban,
  Inbox,
  Plus,
  Receipt,
  Search,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const TYPE_ICON = {
  lead: Inbox,
  client: Users,
  project: FolderKanban,
  invoice: Receipt,
  task: CheckSquare,
} as const;

const TYPE_LABEL: Record<SearchResultItem["type"], string> = {
  lead: "Leads",
  client: "Clientes",
  project: "Proyectos",
  invoice: "Facturas",
  task: "Tareas",
};

const QUICK_LINKS = [
  { href: "/inicio", label: "Ir a Inicio", icon: Search },
  { href: "/leads", label: "Ir a Leads", icon: Inbox },
  { href: "/clients", label: "Ir a Clientes", icon: Users },
  { href: "/projects", label: "Ir a Proyectos", icon: FolderKanban },
  { href: "/invoices", label: "Ir a Facturas", icon: Receipt },
  { href: "/tasks", label: "Ir a Tareas", icon: CheckSquare },
  { href: "/proposals", label: "Ir a Propuestas", icon: FileSignature },
] as const;

const QUICK_ACTIONS = [
  { href: "/leads/new", label: "Nuevo lead", icon: Plus },
  { href: "/clients/new", label: "Nuevo cliente", icon: Plus },
  { href: "/projects/new", label: "Nuevo proyecto", icon: Plus },
  { href: "/tasks/new", label: "Nueva tarea", icon: Plus },
  { href: "/proposals/new", label: "Nueva propuesta", icon: Plus },
] as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { items: SearchResultItem[] };
        setResults(data.items ?? []);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<SearchResultItem["type"], SearchResultItem[]>();
    for (const r of results) {
      const arr = map.get(r.type) ?? [];
      arr.push(r);
      map.set(r.type, arr);
    }
    return map;
  }, [results]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar leads, clientes, proyectos, facturas, tareas…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Buscando…" : query ? "Sin resultados" : "Empieza a escribir para buscar."}
        </CommandEmpty>
        {Array.from(groups.entries()).map(([type, items]) => {
          const Icon = TYPE_ICON[type];
          return (
            <CommandGroup key={type} heading={TYPE_LABEL[type]}>
              {items.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.label} ${r.sublabel ?? ""} ${type}`}
                  onSelect={() => go(r.href)}
                >
                  <Icon className="size-4" />
                  <span className="truncate">{r.label}</span>
                  {r.sublabel ? (
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {r.sublabel}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        {query.trim().length === 0 ? (
          <>
            <CommandGroup heading="Navegación">
              {QUICK_LINKS.map((l) => {
                const Icon = l.icon;
                return (
                  <CommandItem key={l.href} value={l.label} onSelect={() => go(l.href)}>
                    <Icon className="size-4" />
                    {l.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Acciones">
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <CommandItem key={a.href} value={a.label} onSelect={() => go(a.href)}>
                    <Icon className="size-4" />
                    {a.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
