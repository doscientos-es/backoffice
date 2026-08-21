"use client";

import { MessageCircle as MessageCircle, QrCode as QrCode } from "lucide-react";
import Image from "next/image";
import { toDataURL } from "qrcode";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { publicEnv } from "@/lib/env";
import { buildBookingUrl } from "@/lib/recovery/utils";
import { cn } from "@/lib/utils";
import { startLeadCall } from "../actions";

/**
 * Normalises a raw phone string into a clean `tel:` URI value.
 *
 * Rules (in order):
 * 1. Strip everything except digits and `+`.
 * 2. If `+` appears in the middle (e.g. `835+34…`), discard the prefix and
 *    keep from the `+` onwards — this handles operator/country-code prefixes
 *    that leads sometimes include when self-entering their number.
 * 3. Otherwise return the cleaned string as-is.
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const plusIndex = cleaned.indexOf("+");
  if (plusIndex > 0) return cleaned.slice(plusIndex);
  return cleaned;
}

/**
 * Renders a phone number as a clickable `tel:` link plus quick actions to
 * "send" the call to a mobile device from a desktop session:
 * - Copy the number to the clipboard (paste it into the phone).
 * - Scan a QR code with the phone's camera, which opens the dialer with the
 *   number preloaded.
 */
export function LeadCallLink({
  leadId,
  phone,
  children,
  className,
  ...props
}: {
  leadId: string;
  phone: string;
  children: React.ReactNode;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const normalized = normalizePhone(phone);
  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await startLeadCall({ leadId });
    } finally {
      window.location.href = `tel:${normalized}`;
    }
  }

  return (
    <a {...props} href={`tel:${normalized}`} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

export function PhoneQuickActions({
  phone,
  leadId,
  leadName,
  leadEmail,
  firstContactedAt,
  senderName,
}: {
  phone: string;
  leadId?: string;
  leadName?: string;
  leadEmail?: string | null;
  firstContactedAt?: string | null;
  senderName: string;
}) {
  const normalized = normalizePhone(phone);
  return (
    <div className="flex items-center gap-1.5">
      {leadId ? (
        <LeadCallLink
          leadId={leadId}
          phone={phone}
          className="truncate text-primary underline-offset-2 hover:underline"
        >
          {phone}
        </LeadCallLink>
      ) : (
        <a
          href={`tel:${normalized}`}
          className="truncate text-primary underline-offset-2 hover:underline"
        >
          {phone}
        </a>
      )}
      <CopyButton text={normalized} successMessage="Teléfono copiado" label="Copiar teléfono" />
      <PhoneQrPopover phone={phone} />
      {leadId && leadName && (
        <LeadWhatsAppButton
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail ?? null}
          phone={phone}
          firstContactedAt={firstContactedAt}
          senderName={senderName}
        />
      )}
    </div>
  );
}

export function LeadWhatsAppButton({
  leadId,
  leadName,
  leadEmail,
  phone,
  firstContactedAt,
  senderName,
}: {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  phone: string;
  firstContactedAt?: string | null;
  senderName: string;
}) {
  const bookingUrl = buildBookingUrl(publicEnv.NEXT_PUBLIC_CAL_LINK, {
    id: leadId,
    name: leadName,
    email: leadEmail,
  });
  const firstName = leadName.split(" ")[0] || leadName;
  const initialMessage = [
    `Hola, ${firstName}. Soy ${senderName || "el equipo"}, de Doscientos.`,
    "He intentado llamarte porque rellenaste un formulario en uno de nuestros anuncios de Meta.",
    "Me gustaría entender qué necesitas y ver si podemos ayudarte.",
    bookingUrl
      ? `Puedes contarme brevemente por aquí o, si lo prefieres, agendar una reunión: ${bookingUrl}`
      : "Puedes contarme brevemente por aquí y te respondo en cuanto pueda.",
    "¿Qué te resulta más cómodo?",
  ].join("\n\n");
  const message = firstContactedAt
    ? `Hola, ${firstName}. Soy ${senderName || "el equipo"}, de Doscientos.`
    : initialMessage;
  const digits = phone.replace(/\D/g, "");
  const whatsappNumber = digits.length === 9 ? `34${digits}` : digits;
  const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Preparar WhatsApp"
      title="Preparar WhatsApp"
      className="inline-flex size-6 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10"
    >
      <MessageCircle className="size-3.5" />
    </a>
  );
}

function PhoneQrPopover({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  // Regenerate QR every time the popover opens or the phone changes.
  // `qr` is intentionally excluded from deps to avoid an infinite loop.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQr(null);
    toDataURL(`tel:${normalizePhone(phone)}`, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phone]);

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
          <span className="font-medium text-foreground">{normalizePhone(phone)}</span>
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
