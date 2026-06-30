"use client";

import { Input } from "@/components/ui/input";
import { CheckCircle, Loader2, Search, XCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { validateVat } from "./actions";

type VatState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "valid"; name?: string; address?: string }
  | { status: "invalid"; message: string };

/**
 * NIF/CIF input with an inline VIES validation button.
 * Renders as a plain <Input> + button pair — drop-in replacement for the
 * static <Input name="nif" /> in ClientFormFields.
 */
export function NifInput({
  id,
  defaultValue = "",
}: {
  id: string;
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [state, setState] = useState<VatState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const verify = useCallback(async () => {
    const nif = inputRef.current?.value.trim() ?? value.trim();
    if (!nif) {
      setState({ status: "invalid", message: "Introduce un NIF/CIF/VAT primero." });
      return;
    }
    setState({ status: "loading" });
    const result = await validateVat(nif);
    if (result.valid) {
      setState({ status: "valid", name: result.name, address: result.address });
    } else {
      setState({ status: "invalid", message: result.message });
    }
  }, [value]);

  // Reset VIES state when the user starts typing again
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (state.status !== "idle") setState({ status: "idle" });
  };

  const isEU = value.length >= 2 && /^[A-Za-z]{2}/.test(value.trim()) || /^[A-Za-z]/.test(value.trim());

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={id}
          name="nif"
          maxLength={20}
          value={value}
          onChange={handleChange}
          placeholder="B12345678 · ESB12345678"
          autoComplete="off"
          className="flex-1"
        />
        <button
          type="button"
          onClick={verify}
          disabled={state.status === "loading" || !value.trim()}
          title="Verificar número de IVA en VIES (UE)"
          className="inline-flex items-center gap-1.5 px-3 rounded-md border border-input bg-background text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {state.status === "loading" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Search className="size-3.5" />
          )}
          VIES
        </button>
      </div>

      {state.status === "valid" && (
        <p className="flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Válido
            {state.name ? ` · ${state.name}` : ""}
            {state.address ? ` — ${state.address}` : ""}
          </span>
        </p>
      )}

      {state.status === "invalid" && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <XCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>{state.message}</span>
        </p>
      )}

      {state.status === "idle" && isEU && (
        <p className="text-xs text-muted-foreground">
          Pulsa VIES para verificar si está registrado como operador intracomunitario.
        </p>
      )}
    </div>
  );
}
