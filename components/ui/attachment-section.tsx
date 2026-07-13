"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Download, Loader2, Paperclip, UploadCloud } from "lucide-react";
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

const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function AttachmentSection({ entityType, entityId, attachments, canEdit }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  // Tracks nested dragenter/dragleave so the overlay doesn't flicker over children.
  const dragDepth = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  /** Uploads a single file; resolves to an error message or null on success. */
  async function uploadFile(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("entityType", entityType);
      formData.set("entityId", entityId);

      const res = await fetch("/api/attachments/upload", { method: "POST", body: formData });
      const json = (await res.json()) as { id?: string; error?: string };

      if (!res.ok || !json.id) return json.error ?? "Error al subir";
      return null;
    } catch {
      return "Error de red";
    }
  }

  /** Uploads files sequentially, reporting per-file failures. Shared by the button and drop zone. */
  async function uploadFiles(files: File[]) {
    if (files.length === 0 || uploading) return;

    setErrors([]);
    setUploading(true);
    setProgress({ done: 0, total: files.length });

    const failures: string[] = [];
    let done = 0;
    for (const file of files) {
      const err = await uploadFile(file);
      if (err) failures.push(`${file.name}: ${err}`);
      done += 1;
      setProgress({ done, total: files.length });
    }

    setErrors(failures);
    setUploading(false);
    setProgress(null);
    // reset input so the same file can be re-selected after an error
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    void uploadFiles(e.target.files ? Array.from(e.target.files) : []);
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!canEdit || uploading) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!canEdit || uploading) return;
    e.preventDefault();
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!canEdit || uploading) return;
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    if (!canEdit || uploading) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    void uploadFiles(e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []);
  }

  return (
    <Card
      className={cn("relative", dragActive && "ring-2 ring-primary ring-offset-2")}
      onDragEnter={canEdit ? handleDragEnter : undefined}
      onDragOver={canEdit ? handleDragOver : undefined}
      onDragLeave={canEdit ? handleDragLeave : undefined}
      onDrop={canEdit ? handleDrop : undefined}
    >
      {canEdit && dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-primary bg-background/85 backdrop-blur-sm">
          <UploadCloud className="size-6 text-primary" />
          <p className="text-sm font-medium">Suelta los archivos para adjuntarlos</p>
        </div>
      )}
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle>Adjuntos</CardTitle>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              multiple
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
                  {progress ? `Subiendo ${progress.done}/${progress.total}…` : "Subiendo…"}
                </>
              ) : (
                <>
                  <Paperclip className="size-3.5" />
                  Añadir archivos
                </>
              )}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {errors.length > 0 && (
          <ul className="px-6 pb-2 space-y-0.5">
            {errors.map((msg) => (
              <li key={msg} className="text-sm font-medium text-destructive">
                {msg}
              </li>
            ))}
          </ul>
        )}
        {attachments.length === 0 ? (
          <p className="px-6 py-2 text-sm text-muted-foreground">
            {canEdit
              ? "Sin adjuntos. Arrastra archivos aquí o usa «Añadir archivos»."
              : "Sin adjuntos."}
          </p>
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
