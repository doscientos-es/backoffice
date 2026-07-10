"use client";

import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { sileo } from "sileo";

interface CopyButtonProps {
  /** Text that will be written to the clipboard. */
  text: string;
  /** Toast message shown on success. */
  successMessage?: string;
  /** Accessible label for the button. */
  label?: string;
  className?: string;
}

/**
 * Small icon-only button that copies `text` to the clipboard.
 * Shows a ✓ tick for 1.5 s after a successful copy.
 */
export function CopyButton({
  text,
  successMessage = "Copiado al portapapeles",
  label = "Copiar",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      sileo.success({ title: successMessage });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      sileo.error({ title: "No se pudo copiar" });
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
