"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteToken } from "../actions";
import { type BrandToken, TokenEditDialog } from "./token-edit-dialog";

const GROUP_LABELS: Record<BrandToken["token_group"], string> = {
  color: "Colores",
  typography: "Tipografía",
  spacing: "Espaciado",
  radius: "Radios",
  shadow: "Sombras",
};

function isColor(value: string) {
  return /^(#|oklch|rgb|hsl|color-)/.test(value.trim());
}

function ColorSwatch({ value }: { value: string }) {
  return (
    <span
      className="inline-block size-4 rounded-sm border border-border shrink-0"
      style={{ background: value }}
      title={value}
    />
  );
}

function TokenRow({
  token,
  isAdmin,
  onEdit,
}: {
  token: BrandToken;
  isAdmin: boolean;
  onEdit: (t: BrandToken) => void;
}) {
  const [pending, startTransition] = useTransition();
  const showSwatch = token.token_group === "color" && isColor(token.value);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {showSwatch && <ColorSwatch value={token.value} />}
        <code className="text-xs font-mono text-foreground shrink-0">--{token.key}</code>
        <span className="text-xs text-muted-foreground truncate">{token.value}</span>
        {token.value_dark && (
          <Badge variant="neutral" className="text-[10px] shrink-0">
            dark: {token.value_dark}
          </Badge>
        )}
      </div>
      {token.description && (
        <span className="text-xs text-muted-foreground hidden md:block truncate max-w-xs">
          {token.description}
        </span>
      )}
      {isAdmin && (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(token)} title="Editar">
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            disabled={pending}
            title="Eliminar"
            onClick={() => {
              if (!confirm(`¿Eliminar el token --${token.key}?`)) return;
              startTransition(async () => {
                await deleteToken({ id: token.id });
              });
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function TokensPanel({
  tokens,
  isAdmin,
}: {
  tokens: BrandToken[];
  isAdmin: boolean;
}) {
  const [editTarget, setEditTarget] = useState<BrandToken | null | undefined>(undefined);
  const grouped = tokens.reduce<Partial<Record<BrandToken["token_group"], BrandToken[]>>>(
    (acc, t) => {
      if (!acc[t.token_group]) acc[t.token_group] = [];
      acc[t.token_group]!.push(t);
      return acc;
    },
    {},
  );
  const orderedGroups = (
    ["color", "typography", "spacing", "radius", "shadow"] as BrandToken["token_group"][]
  ).filter((g) => grouped[g]?.length);

  return (
    <>
      <div className="flex flex-col gap-6">
        {isAdmin && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditTarget(null)}>
              <Plus className="size-3.5" />
              Nuevo token
            </Button>
          </div>
        )}

        {orderedGroups.map((group) => (
          <section key={group} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {GROUP_LABELS[group]}
            </h3>
            <div className="flex flex-col gap-1.5">
              {(grouped[group] ?? []).map((t) => (
                <TokenRow key={t.id} token={t} isAdmin={isAdmin} onEdit={setEditTarget} />
              ))}
            </div>
          </section>
        ))}

        {tokens.length === 0 && (
          <p className="text-sm text-muted-foreground py-10 text-center">
            No hay tokens. Añade el primero.
          </p>
        )}
      </div>

      {editTarget !== undefined && (
        <TokenEditDialog
          open
          token={editTarget}
          onOpenChange={(v) => {
            if (!v) setEditTarget(undefined);
          }}
        />
      )}
    </>
  );
}
