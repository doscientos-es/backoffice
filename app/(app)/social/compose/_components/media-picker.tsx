"use client";

import type { MediaItem } from "@/lib/social/core";
import { cn } from "@/lib/utils";
import { Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { MediaThumb } from "../../_components/media-thumb";

/**
 * Controlled media picker. Uploads File bytes to /api/social/upload (which
 * returns public MediaItem[]), then hands the resulting items up to the form.
 * Raw bytes never touch the JSON server action — only the public URLs do.
 */
export function MediaPicker({
  value,
  onChange,
  disabled,
  max = 10,
}: {
  value: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  disabled?: boolean;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const room = max - value.length;
    if (room <= 0) {
      setError(`Máximo ${max} archivos`);
      return;
    }
    const body = new FormData();
    for (const f of Array.from(files).slice(0, room)) body.append("files", f);

    setUploading(true);
    try {
      const res = await fetch("/api/social/upload", { method: "POST", body });
      const json = (await res.json()) as { media?: MediaItem[]; error?: string };
      if (!res.ok || !json.media) {
        setError(json.error ?? "Error subiendo archivos");
        return;
      }
      onChange([...value, ...json.media]);
    } catch {
      setError("Error de red al subir");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {value.map((item) => (
          <div key={item.storagePath} className="group relative">
            <MediaThumb item={item} />
            <button
              type="button"
              onClick={() => onChange(value.filter((m) => m.storagePath !== item.storagePath))}
              className="absolute -right-1.5 -top-1.5 grid size-5 place-content-center rounded-full bg-destructive text-white shadow ring-2 ring-card transition-opacity"
              aria-label="Quitar archivo"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "grid aspect-square place-content-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50",
            )}
            aria-label="Añadir archivos"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {value.length}/{max} archivos · imágenes o vídeo
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
