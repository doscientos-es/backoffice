"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GoogleBusinessMediaItem } from "@/lib/social/google-business/profile";
import { Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addGoogleBusinessPhoto, removeGoogleBusinessPhoto } from "../actions";

const CATEGORIES = [
  ["ADDITIONAL", "Adicional"],
  ["COVER", "Portada"],
  ["PROFILE", "Perfil"],
  ["LOGO", "Logotipo"],
  ["EXTERIOR", "Exterior"],
  ["INTERIOR", "Interior"],
  ["PRODUCT", "Producto"],
  ["AT_WORK", "En el trabajo"],
  ["FOOD_AND_DRINK", "Comida y bebida"],
  ["MENU", "Menú"],
  ["TEAMS", "Equipo"],
] as const;

export function GoogleBusinessMediaPanel({ media }: { media: GoogleBusinessMediaItem[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>("ADDITIONAL");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPending(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const upload = await fetch("/api/social/upload", { method: "POST", body: formData });
      const payload = (await upload.json()) as { media?: Array<{ publicUrl: string }>; error?: string };
      if (!upload.ok || !payload.media?.[0]?.publicUrl) throw new Error(payload.error ?? "No se pudo subir la foto.");
      const result = await addGoogleBusinessPhoto({
        sourceUrl: payload.media[0].publicUrl,
        category,
        description: description || undefined,
      });
      if (!result.ok) throw new Error(result.error);
      setDescription("");
      setMessage("Foto añadida a Google");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo añadir la foto.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(mediaName: string) {
    if (!window.confirm("¿Eliminar esta foto de Google Business Profile?")) return;
    setPending(true);
    const result = await removeGoogleBusinessPhoto({ mediaName });
    setMessage(result.ok ? "Foto eliminada" : result.error);
    if (result.ok) router.refresh();
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-xs font-medium">
          Categoría
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
            disabled={pending}
          >
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Descripción opcional"
          maxLength={1000}
          className="min-h-8 resize-none text-sm"
          disabled={pending}
        />
        <Button asChild size="sm" disabled={pending}>
          <label className="cursor-pointer">
            <Upload className="size-3.5" />
            {pending ? "Procesando…" : "Subir foto"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleUpload} />
          </label>
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      {media.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((item) => (
            <div key={item.name} className="group relative overflow-hidden rounded-lg border border-border">
              <img src={item.googleUrl ?? item.sourceUrl} alt={item.description ?? "Foto de la ficha"} className="aspect-square w-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => handleDelete(item.name)}
                disabled={pending}
                className="absolute top-1 right-1 rounded-full bg-black/70 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Eliminar foto"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No hay fotos sincronizadas en la ficha.</p>
      )}
    </div>
  );
}