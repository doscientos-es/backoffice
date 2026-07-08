"use client";

import type { SearchResultItem } from "@/app/api/search/route";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/layout/command-palette-trigger";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  CREATE_SHORTCUTS,
  NAV_SHORTCUTS,
  RECENTS_STORAGE_KEY,
  type RecentItem,
  mergeRecentItems,
} from "@/lib/navigation/shortcuts";
import {
  Archive,
  Bell,
  CheckSquare,
  Clock,
  FileSignature,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  Megaphone,
  Plus,
  Receipt,
  Repeat,
  Settings,
  Users,
  Wallet,
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

const NAV_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "/inicio": Home,
  "/leads": Inbox,
  "/marketing": Megaphone,
  "/clients": Users,
  "/projects": FolderKanban,
  "/proposals": FileSignature,
  "/invoices": Receipt,
  "/subscriptions": Repeat,
  "/tasks": CheckSquare,
  "/finance": Wallet,
  "/reminders": Bell,
  "/documents": FileText,
  "/internal-docs": Archive,
  "/settings": Settings,
};

/** Secciones sin chord dedicado (cubiertas solo por el palette). */
const EXTRA_LINKS = [
  { href: "/subscriptions", label: "Suscripciones" },
  { href: "/finance", label: "Finanzas" },
  { href: "/reminders", label: "Recordatorios" },
  { href: "/documents", label: "Documentos" },
  { href: "/internal-docs", label: "Docs internos" },
  { href: "/settings", label: "Ajustes" },
] as const;

function loadRecents(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    setRecents(loadRecents());
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

  const selectResult = useCallback(
    (item: RecentItem) => {
      const next = mergeRecentItems(loadRecents(), item);
      try {
        window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage no disponible: continúa sin persistir.
      }
      go(item.href);
    },
    [go],
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
                  onSelect={() => selectResult({ href: r.href, label: r.label, type })}
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
            {recents.length > 0 ? (
              <>
                <CommandGroup heading="Recientes">
                  {recents.map((r) => {
                    const Icon = r.type
                      ? (TYPE_ICON[r.type as SearchResultItem["type"]] ?? Clock)
                      : Clock;
                    return (
                      <CommandItem
                        key={r.href}
                        value={`reciente ${r.label}`}
                        onSelect={() => selectResult(r)}
                      >
                        <Icon className="size-4" />
                        <span className="truncate">{r.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}
            <CommandGroup heading="Navegación">
              {NAV_SHORTCUTS.map((l) => {
                const Icon = NAV_ICON[l.href] ?? Home;
                return (
                  <CommandItem key={l.href} value={`ir a ${l.label}`} onSelect={() => go(l.href)}>
                    <Icon className="size-4" />
                    {l.label}
                    <CommandShortcut>G {l.key.toUpperCase()}</CommandShortcut>
                  </CommandItem>
                );
              })}
              {EXTRA_LINKS.map((l) => {
                const Icon = NAV_ICON[l.href] ?? Home;
                return (
                  <CommandItem key={l.href} value={`ir a ${l.label}`} onSelect={() => go(l.href)}>
                    <Icon className="size-4" />
                    {l.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Acciones">
              {CREATE_SHORTCUTS.map((a) => (
                <CommandItem key={a.href} value={a.label} onSelect={() => go(a.href)}>
                  <Plus className="size-4" />
                  {a.label}
                  <CommandShortcut>C {a.key.toUpperCase()}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
