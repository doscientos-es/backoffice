"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, Paperclip } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export type AttachmentItem = {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type EntityType = "lead" | "project" | "proposal" | "client";

interface Props {
  entityType: EntityType;
  entityId: string;
  attachments: AttachmentItem[];
  canEdit: boolean;
}

const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.zip";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function AttachmentSection({ entityType, entityId, attachments, canEdit }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("entityType", entityType);
      formData.set("entityId", entityId);

      const res = await fetch("/api/attachments/upload", { method: "POST", body: formData });
      const json = (await res.json()) as { id?: string; error?: string };

      if (!res.ok || !json.id) {
        setError(json.error ?? "Error al subir el archivo");
        return;
      }

      router.refresh();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setUploading(false);
      // reset input so the same file can be re-uploaded after an error
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle>Adjuntos</CardTitle>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Subiendo…
                </>
              ) : (
                <>
                  <Paperclip className="size-3.5" />
                  Añadir archivo
                </>
              )}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {error && (
          <p className="px-6 pb-2 text-sm font-medium text-destructive">{error}</p>
        )}
        {attachments.length === 0 ? (
          <p className="px-6 py-2 text-sm text-muted-foreground">Sin adjuntos.</p>
        ) : (
          <ul className="divide-y divide-border">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-6 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  {a.size_bytes ? (
                    <p className="text-xs text-muted-foreground">{formatSize(a.size_bytes)}</p>
                  ) : null}
                </div>
                <Button asChild variant="ghost" size="icon" className="shrink-0 size-7">
                  <Link
                    href={`/api/documents/${a.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Descargar"
                  >
                    <Download className="size-3.5" />
                    <span className="sr-only">Descargar</span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
