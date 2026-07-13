"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTransition } from "react";
import { upsertToken } from "../actions";

export type BrandToken = {
  id: string;
  token_group: "color" | "typography" | "spacing" | "radius" | "shadow";
  key: string;
  value: string;
  value_dark: string | null;
  description: string | null;
  sort_order: number;
};

const GROUP_LABELS = {
  color: "Color",
  typography: "Tipografía",
  spacing: "Espaciado",
  radius: "Radio",
  shadow: "Sombra",
} as const;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token?: BrandToken | null;
}

export function TokenEditDialog({ open, onOpenChange, token }: Props) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      id: token?.id,
      token_group: fd.get("token_group") as BrandToken["token_group"],
      key: (fd.get("key") as string).trim(),
      value: (fd.get("value") as string).trim(),
      value_dark: (fd.get("value_dark") as string).trim() || undefined,
      description: (fd.get("description") as string).trim() || undefined,
      sort_order: token?.sort_order ?? 0,
    };
    startTransition(async () => {
      const res = await upsertToken(payload);
      if (res.ok) onOpenChange(false);
      else alert(res.error ?? "Error al guardar");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{token ? "Editar token" : "Nuevo token"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <FormRow label="Grupo" htmlFor="token_group" required>
            <Select id="token_group" name="token_group" defaultValue={token?.token_group ?? "color"}>
              {Object.entries(GROUP_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </FormRow>

          <FormRow label="Nombre del token" htmlFor="key" required>
            <Input id="key" name="key" required maxLength={80} placeholder="primary"
              defaultValue={token?.key ?? ""} />
          </FormRow>

          <FormRow label="Valor (light)" htmlFor="value" required>
            <Input id="value" name="value" required maxLength={400} placeholder="#2a4227"
              defaultValue={token?.value ?? ""} />
          </FormRow>

          <FormRow label="Valor (dark)" htmlFor="value_dark">
            <Input id="value_dark" name="value_dark" maxLength={400} placeholder="oklch(0.922 0 0)"
              defaultValue={token?.value_dark ?? ""} />
          </FormRow>

          <FormRow label="Descripción" htmlFor="description">
            <Textarea id="description" name="description" maxLength={300} rows={2}
              placeholder="Uso de este token…" defaultValue={token?.description ?? ""} />
          </FormRow>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
