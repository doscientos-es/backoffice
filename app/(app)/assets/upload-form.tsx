"use client";

import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const CATEGORIES = [
  { value: "logo", label: "Logo" },
  { value: "isotipo", label: "Isotipo" },
  { value: "background", label: "Background" },
  { value: "banner", label: "Banner" },
  { value: "other", label: "Otro" },
] as const;

const ACCEPTED = ".png,.jpg,.jpeg,.webp,.svg,.gif";

export function UploadAssetForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Selecciona un archivo"); return; }

    const formData = new FormData(e.currentTarget);
    formData.set("file", file);

    setUploading(true);
    try {
      const res = await fetch("/api/brand-assets/upload", { method: "POST", body: formData });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) { setError(json.error ?? "Error al subir"); return; }
      router.push("/assets");
      router.refresh();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormRow label="Archivo" htmlFor="file" required>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            id="file"
            name="file"
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            required
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <ImageUp className="size-3.5" />
            Seleccionar imagen
          </Button>
          {fileName ? (
            <span className="truncate text-sm text-muted-foreground max-w-xs">{fileName}</span>
          ) : (
            <span className="text-sm text-muted-foreground">
              PNG, JPEG, WebP, SVG, GIF · Máx. 20 MB
            </span>
          )}
        </div>
      </FormRow>

      <FormRow label="Nombre del asset" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          required
          maxLength={200}
          placeholder="Logo principal doscientos"
        />
      </FormRow>

      <FormRow label="Categoría" htmlFor="category">
        <Select id="category" name="category" defaultValue="logo">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
      </FormRow>

      <FormRow label="Descripción" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          maxLength={500}
          rows={2}
          placeholder="Uso recomendado, variante, fondo…"
        />
      </FormRow>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/assets">Cancelar</Link>
        </Button>
        <Button type="submit" size="sm" disabled={uploading}>
          {uploading ? (
            <><Loader2 className="size-3.5 animate-spin" />Subiendo…</>
          ) : (
            "Subir asset"
          )}
        </Button>
      </div>
    </form>
  );
}
