"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { AssetsGrid, type BrandAsset } from "./assets-grid";
import { BrandExport } from "./brand-export";
import type { BrandToken } from "./token-edit-dialog";
import { TokensPanel } from "./tokens-panel";

type Tab = "assets" | "tokens" | "export";

const TABS: { id: Tab; label: string }[] = [
  { id: "assets", label: "Assets" },
  { id: "tokens", label: "Tokens" },
  { id: "export", label: "Exportar" },
];

interface Props {
  assets: BrandAsset[];
  tokens: BrandToken[];
  isAdmin: boolean;
  className?: string;
}

export function BrandHub({ assets, tokens, isAdmin, className }: Props) {
  const [active, setActive] = useState<Tab>("assets");

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Tab bar */}
      <div className="shrink-0 flex gap-0.5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2",
              active === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-4">
        {active === "assets" &&
          (assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Aún no hay assets. Sube el primer logo o recurso visual.
            </p>
          ) : (
            <AssetsGrid assets={assets} isAdmin={isAdmin} />
          ))}
        {active === "tokens" && <TokensPanel tokens={tokens} isAdmin={isAdmin} />}
        {active === "export" && <BrandExport tokens={tokens} assets={assets} />}
      </div>
    </div>
  );
}
