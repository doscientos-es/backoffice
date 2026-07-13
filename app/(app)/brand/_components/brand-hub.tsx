"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetsGrid, type BrandAsset } from "./assets-grid";
import { BrandExport } from "./brand-export";
import { TokensPanel } from "./tokens-panel";
import type { BrandToken } from "./token-edit-dialog";

interface Props {
  assets: BrandAsset[];
  tokens: BrandToken[];
  isAdmin: boolean;
}

export function BrandHub({ assets, tokens, isAdmin }: Props) {
  return (
    <Tabs defaultValue="assets" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="assets">Assets</TabsTrigger>
        <TabsTrigger value="tokens">Tokens</TabsTrigger>
        <TabsTrigger value="export">Exportar</TabsTrigger>
      </TabsList>

      <TabsContent value="assets">
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Aún no hay assets. Sube el primer logo o recurso visual.
          </p>
        ) : (
          <AssetsGrid assets={assets} isAdmin={isAdmin} />
        )}
      </TabsContent>

      <TabsContent value="tokens">
        <TokensPanel tokens={tokens} isAdmin={isAdmin} />
      </TabsContent>

      <TabsContent value="export">
        <BrandExport tokens={tokens} assets={assets} />
      </TabsContent>
    </Tabs>
  );
}
