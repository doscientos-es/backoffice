"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExternalLink, Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { getAdPreviewAction } from "./actions";

type AdFormat = "DESKTOP_FEED_STANDARD" | "MOBILE_FEED_STANDARD" | "INSTAGRAM_STANDARD";

const FORMATS: { value: AdFormat; label: string }[] = [
  { value: "DESKTOP_FEED_STANDARD", label: "Facebook Desktop" },
  { value: "MOBILE_FEED_STANDARD", label: "Facebook Mobile" },
  { value: "INSTAGRAM_STANDARD", label: "Instagram Feed" },
];

type Props = {
  adId: string;
  adName: string;
  campaignName: string;
  adsManagerUrl: string | null;
};

export function AdPreviewDialog({ adId, adName, campaignName, adsManagerUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<AdFormat>("DESKTOP_FEED_STANDARD");
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(next: AdFormat) {
    setLoading(true);
    setError(null);
    setBody(null);
    const result = await getAdPreviewAction(adId, next);
    if (result.ok) {
      setBody(result.body);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !body && !loading) load(format);
  }

  function onFormatChange(next: AdFormat) {
    setFormat(next);
    load(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Previsualizar anuncio">
          <Eye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="truncate">{adName}</DialogTitle>
          <DialogDescription>{campaignName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1 border-b pb-2">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onFormatChange(f.value)}
              className={
                f.value === format
                  ? "rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background"
                  : "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-md bg-muted/30">
          {loading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : error ? (
            <p className="px-4 text-center text-sm text-destructive">{error}</p>
          ) : body ? (
            // Meta returns a self-contained `<iframe src="...">` snippet.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Meta-hosted iframe
            <div
              className="w-full [&_iframe]:h-[420px] [&_iframe]:w-full [&_iframe]:border-0"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin previa disponible.</p>
          )}
        </div>

        {adsManagerUrl ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={adsManagerUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Editar en Meta Ads Manager
            </a>
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
