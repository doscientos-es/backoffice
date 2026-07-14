"use client";

import { CopyButton } from "@/components/ui/copy-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { QrCode } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";

/**
 * Renders a phone number as a clickable `tel:` link plus quick actions to
 * "send" the call to a mobile device from a desktop session:
 * - Copy the number to the clipboard (paste it into the phone).
 * - Scan a QR code with the phone's camera, which opens the dialer with the
 *   number preloaded.
 */
export function PhoneQuickActions({ phone }: { phone: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <a
        href={`tel:${phone}`}
        className="truncate text-primary underline-offset-2 hover:underline"
      >
        {phone}
      </a>
      <CopyButton
        text={phone}
        successMessage="Teléfono copiado"
        label="Copiar teléfono"
      />
      <PhoneQrPopover phone={phone} />
    </div>
  );
}

function PhoneQrPopover({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || qr) return;
    let cancelled = false;
    toDataURL(`tel:${phone}`, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, qr, phone]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Mostrar QR para llamar desde el móvil"
          title="Llamar desde el móvil (QR)"
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          )}
        >
          <QrCode className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto flex-col items-center gap-2 p-3">
        <p className="text-center text-xs text-muted-foreground">
          Escanea con el móvil para llamar a
          <br />
          <span className="font-medium text-foreground">{phone}</span>
        </p>
        <div className="flex size-[220px] items-center justify-center rounded-md bg-muted">
          {qr ? (
            <Image
              src={qr}
              alt={`QR para llamar a ${phone}`}
              width={220}
              height={220}
              unoptimized
            />
          ) : (
            <span className="text-xs text-muted-foreground">Generando…</span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
