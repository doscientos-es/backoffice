"use client";

import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { sendToAeat } from "../actions";

export function SendAeatButton({
  invoiceId,
  disabled,
  label = "Enviar a AEAT",
}: { invoiceId: string; disabled?: boolean; label?: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    const fd = new FormData();
    fd.set("id", invoiceId);
    start(async () => {
      const result = await sendToAeat(fd);
      if (result.ok) {
        toast.success(
          result.csv ? `Factura aceptada · CSV ${result.csv}` : "Factura procesada",
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="default"
      disabled={disabled || pending}
      onClick={onClick}
    >
      <Send className="size-4" />
      {pending ? "Enviando…" : label}
    </Button>
  );
}
