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
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  Clock,
  FileSignature,
  FileText,
  FolderKanban,
  Globe,
  Home,
  Inbox,
  KeyRound,
  Loader2,
  Megaphone,
  Plus,
  Receipt,
  Repeat,
  Settings,
  Share2,
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
  vault: KeyRound,
} as const;

const TYPE_LABEL: Record<SearchResultItem["type"], string> = {
  lead: "Leads",
  client: "Clientes",
  project: "Proyectos",
  invoice: "Facturas",
  task: "Tareas",
  vault: "Bóveda",
};

const NAV_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "/inicio": Home,
  "/calendar": CalendarDays,
  "/leads": Inbox,
  "/clients": Users,
  "/projects": FolderKanban,
  "/proposals": FileSignature,
  "/invoices": Receipt,
  "/subscriptions": Repeat,
  "/finance": Wallet,
  "/finance/expenses": Wallet,
  "/finance/portfolio": BarChart3,
  "/tasks": CheckSquare,
  "/reminders": Bell,
  "/marketing": Megaphone,
  "/social": Share2,
  "/documents": FileText,
  "/internal-docs": Archive,
  "/settings": Settings,
  "/webs": Globe,
  "/vault": KeyRound,
};

/**
 * Lista unificada de navegación: NAV_SHORTCUTS (con chord) + páginas extra.
 * Sin duplicados, sin EXTRA_LINKS separado.
 */
const ALL_NAV: Array<{ href: string; label: string; key?: string }> = [
  ...NAV_SHORTCUTS,
  { href: "/calendar", label: "Agenda" },
  { href: "/social", label: "Social" },
  { href: "/finance", label: "Finanzas" },
  { href: "/finance/portfolio", label: "Portfolio" },
  { href: "/documents", label: "Documentos" },
  { href: "/internal-docs", label: "Docs internos" },
  { href: "/settings", label: "Ajustes" },
];

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

  // ── Vault (secretos) ──────────────────────────────────────────────────────
  // Secretos revelados en memoria mientras el palette está abierto (clave = uuid).
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [vaultBusyId, setVaultBusyId] = useState<string | null>(null);
  const [vaultCopiedId, setVaultCopiedId] = useState<string | null>(null);
  // Diálogo de desbloqueo pendiente: qué secreto y qué acción reintentar tras unlock.
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState<{
    id: string;
    name: string;
    mode: "copy" | "reveal";
  } | null>(null);

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
      // No conservar secretos revelados ni estados de la bóveda al cerrar.
      setRevealed({});
      setVaultBusyId(null);
      setVaultCopiedId(null);
      setUnlockOpen(false);
      setPendingUnlock(null);
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

  const hasResults = results.length > 0;
  const isSearching = query.trim().length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar clientes, proyectos, leads…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Estado vacío / buscando */}
        <CommandEmpty>
          {loading ? (
            <span className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Buscando…
            </span>
          ) : isSearching ? (
            <span className="flex flex-col items-center gap-0.5">
              <span className="font-medium">Sin resultados</span>
              <span className="text-xs text-muted-foreground">
                No hay nada que coincida con "{query}"
              </span>
            </span>
          ) : null}
        </CommandEmpty>

        {/* Indicador de carga mientras hay resultados previos */}
        {loading && hasResults && (
          <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-muted-foreground/60">
            <Loader2 className="size-2.5 animate-spin" />
            Actualizando…
          </div>
        )}

        {/* Resultados de búsqueda agrupados por tipo */}
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
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{r.label}</span>
                  {r.sublabel ? (
                    <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground max-w-[40%]">
                      {r.sublabel}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {/* Estado vacío: recientes + navegación + acciones */}
        {!isSearching ? (
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
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{r.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            ) : null}

            <CommandGroup heading="Ir a…">
              {ALL_NAV.map((l) => {
                const Icon = NAV_ICON[l.href] ?? Home;
                return (
                  <CommandItem key={l.href} value={`ir a ${l.label}`} onSelect={() => go(l.href)}>
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    {l.label}
                    {l.key ? (
                      <CommandShortcut className="hidden sm:inline">
                        G {l.key.toUpperCase()}
                      </CommandShortcut>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Crear">
              {CREATE_SHORTCUTS.map((a) => (
                <CommandItem key={a.href} value={`crear ${a.label}`} onSelect={() => go(a.href)}>
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                  {a.label}
                  <CommandShortcut className="hidden sm:inline">
                    C {a.key.toUpperCase()}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
