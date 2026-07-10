"use client";

import { getBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

const BUCKET = "client-logos";
const MAX_PX = 480;
const QUALITY = 0.82;

async function resizeAndCompress(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context error"));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/webp",
        QUALITY,
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function ClientLogoUpload({
  defaultLogoUrl,
  clientId,
}: {
  defaultLogoUrl?: string | null;
  /** When editing an existing client, pass the id to use as stable filename. */
  clientId?: string;
}) {
  const [preview, setPreview] = useState<string | null>(defaultLogoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(defaultLogoUrl ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const blob = await resizeAndCompress(file);
      const path = clientId
        ? `${clientId}.webp`
        : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      const supabase = getBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/webp", upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      // Cache-bust so the browser shows the new image even if path is same
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setPreview(url);
      setLogoUrl(data.publicUrl); // store clean URL (no cache-bust) in DB
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    setLogoUrl("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex items-start gap-4">
      {/* Hidden form field carrying the stored URL */}
      <input type="hidden" name="logo_url" value={logoUrl} />

      {/* Drop zone / preview */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "relative flex size-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          uploading && "cursor-wait opacity-60",
        )}
        aria-label="Subir logo"
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : preview ? (
          <Image
            src={preview}
            alt="Logo"
            fill
            className="rounded-xl object-contain p-1"
            unoptimized
          />
        ) : (
          <ImagePlus className="size-5 text-muted-foreground" />
        )}
      </button>

      <div className="flex flex-col gap-1.5 pt-1">
        <p className="text-sm font-medium text-foreground">
          Logo del cliente{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </p>
        <p className="text-xs text-muted-foreground">
          PNG, JPG o WebP · Se redimensiona a 480 px automáticamente.
        </p>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            className="flex w-fit items-center gap-1 text-xs text-destructive hover:underline"
          >
            <X className="size-3" /> Eliminar logo
          </button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
