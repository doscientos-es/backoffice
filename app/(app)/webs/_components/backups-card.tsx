"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FileBrowserItem, FileBrowserListing } from "@/lib/filebrowser";
import { ChevronLeft, Download, FolderOpen, HardDrive, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ForceBackupButton } from "./force-backup-button";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Inner components ─────────────────────────────────────────────────────────

function FolderRow({ item, onClick }: { item: FileBrowserItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
    >
      <FolderOpen className="size-4 shrink-0 text-amber-500" />
      <span className="flex-1 truncate text-left font-medium">{item.name}</span>
      <ChevronLeft className="size-4 shrink-0 rotate-180 text-muted-foreground" />
    </button>
  );
}

function FileRow({
  item,
  clientSlug,
  subPath,
}: { item: FileBrowserItem; clientSlug: string; subPath: string }) {
  const filePath = subPath ? `${subPath}/${item.name}` : item.name;
  const downloadUrl = `/api/backups/${clientSlug}/download?path=${encodeURIComponent(filePath)}`;

  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm">
      <HardDrive className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-mono text-xs">{item.name}</span>
        <span className="text-xs text-muted-foreground">{formatDate(item.modified)}</span>
      </div>
      <Badge variant="neutral" className="shrink-0 font-mono text-[10px]">
        {formatBytes(item.size)}
      </Badge>
      <a href={downloadUrl} download className="ml-1 shrink-0">
        <Button variant="ghost" size="icon" className="size-7">
          <Download className="size-3.5" />
        </Button>
      </a>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BackupsCard({
  clientSlug,
  projectId,
  canForceBackup = false,
}: {
  clientSlug: string;
  projectId?: string;
  canForceBackup?: boolean;
}) {
  const [subPath, setSubPath] = useState("");
  const [listing, setListing] = useState<FileBrowserListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchListing = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(false);
      try {
        const url = `/api/backups/${clientSlug}${path ? `?path=${encodeURIComponent(path)}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        setListing(await res.json());
      } catch {
        setError(true);
        setListing(null);
      } finally {
        setLoading(false);
      }
    },
    [clientSlug],
  );

  useEffect(() => {
    fetchListing(subPath);
  }, [fetchListing, subPath]);

  const dirs = listing?.items.filter((i) => i.isDir) ?? [];
  const files = listing?.items.filter((i) => !i.isDir) ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Copias de seguridad</CardTitle>
          <div className="flex items-center gap-1">
            {subPath && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setSubPath("")}
              >
                <ChevronLeft className="size-3" />
                Volver
              </Button>
            )}
            {canForceBackup && projectId && (
              <ForceBackupButton projectId={projectId} slug={clientSlug} />
            )}
          </div>
        </div>
        {subPath && <p className="font-mono text-[11px] text-muted-foreground">{subPath}</p>}
      </CardHeader>
      <CardContent className="px-0 pb-1">
        {loading && (
          <div className="flex flex-col gap-1 px-3">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-9 w-full rounded-md" />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-start gap-2 px-6 py-3">
            <p className="text-sm text-muted-foreground">
              No se pudieron cargar los backups. Verifique la conexión con FileBrowser.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => fetchListing(subPath)}
            >
              <RefreshCw className="size-3" />
              Reintentar
            </Button>
          </div>
        )}
        {!loading && !error && listing && dirs.length + files.length === 0 && (
          <p className="px-6 py-3 text-sm text-muted-foreground">Sin archivos.</p>
        )}
        {!loading && !error && listing && (
          <div className="flex flex-col divide-y divide-border/50">
            {dirs.map((item) => (
              <FolderRow
                key={item.name}
                item={item}
                onClick={() => setSubPath(subPath ? `${subPath}/${item.name}` : item.name)}
              />
            ))}
            {files.map((item) => (
              <FileRow key={item.name} item={item} clientSlug={clientSlug} subPath={subPath} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
