"use client";

import { CREATE_SHORTCUTS, NAV_SHORTCUTS, findShortcut } from "@/lib/navigation/shortcuts";
import { ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Prefix = "g" | "c";

const RESET_MS = 1500;

/**
 * Manejador global de atajos de teclado (chord secuencial).
 * `g` + tecla navega; `c` + tecla crea. Único punto de control para
 * evitar colisiones entre ambos prefijos.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const prefixRef = useRef<Prefix | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [armed, setArmed] = useState<Prefix | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      prefixRef.current = null;
      setArmed(null);
    };

    const arm = (p: Prefix) => {
      prefixRef.current = p;
      setArmed(p);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        prefixRef.current = null;
        setArmed(null);
      }, RESET_MS);
    };

    const onKey = (e: KeyboardEvent) => {
      // Respeta combinaciones del SO/navegador (Ctrl+C, Cmd+K, Alt+←, …).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }
      // No secuestrar teclas mientras un diálogo/command palette está abierto.
      if (document.querySelector('[data-slot="dialog-content"]')) return;

      const key = e.key.toLowerCase();
      const active = prefixRef.current;

      if (!active) {
        if (key === "g" || key === "c") {
          e.preventDefault();
          arm(key);
        }
        return;
      }

      const list = active === "g" ? NAV_SHORTCUTS : CREATE_SHORTCUTS;
      const match = findShortcut(list, key);
      if (match) {
        e.preventDefault();
        router.push(match.href);
      }
      clear();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  if (!armed) return null;

  const Icon = armed === "g" ? ArrowRight : Plus;
  const text = armed === "g" ? "Ir a…" : "Crear…";

  return (
    <output
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground shadow-md"
    >
      <Icon className="h-3.5 w-3.5 text-primary" />
      <kbd className="rounded bg-secondary px-1 font-mono text-foreground uppercase">{armed}</kbd>
      <span>{text}</span>
    </output>
  );
}
