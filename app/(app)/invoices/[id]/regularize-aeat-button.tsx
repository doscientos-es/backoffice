"use client";

import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { verifyWithPasskey } from "@/lib/security/webauthn-client";
import { regularizeVerifactu } from "../actions";

/**
 * Recovery action for a record confirmed absent from AEAT. It deliberately
 * asks for confirmation because it appends a new immutable fiscal record.
 */
export function RegularizeAeatButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"confirm" | "verifying" | "sending" | "success" | "error">(
    "confirm",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);

  async function onClick() {
    setOpen(true);
    setPhase("verifying");
    setMessage(null);
    setCsv(null);
    const verification = await verifyWithPasskey(
      userVerificationScope("invoice.verifactu_regularize", `invoice:${invoiceId}`),
    );
    if (!verification.ok) {
      setPhase("error");
      setMessage(verification.error);
      return;
    }

    setPhase("sending");
    const fd = new FormData();
    fd.set("id", invoiceId);
    const result = await regularizeVerifactu(fd);
    if (result.ok) {
      if (result.status === "accepted") {
        setPhase("success");
        setCsv(result.csv);
        setMessage("La factura ha quedado aceptada por AEAT y la cadena puede continuar.");
      } else {
        setPhase("error");
        setMessage(result.error ?? "La regularización quedó pendiente de envío.");
      }
      router.refresh();
      return;
    }
    setPhase("error");
    setMessage(result.error);
    router.refresh();
  }

  const busy = phase === "verifying" || phase === "sending";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full justify-center whitespace-nowrap"
        onClick={() => {
          setPhase("confirm");
          setMessage(null);
          setCsv(null);
          setOpen(true);
        }}
      >
        <RotateCcw className="size-4" />
        Regularizar y enviar
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !busy && setOpen(nextOpen)}>
        <DialogContent className="sm:max-w-md">
          {phase === "confirm" ? (
            <>
              <DialogHeader>
                <DialogTitle>Regularizar envío VERI*FACTU</DialogTitle>
                <DialogDescription>
                  Usa esta opción solo si has confirmado que AEAT no tiene registrado el alta
                  anterior. Se conservará el intento original y se generará un nuevo registro de
                  subsanación con el certificado actual.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={onClick}>
                  <RotateCcw className="size-4" />
                  Confirmar y continuar
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {phase === "verifying" || phase === "sending" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {phase === "verifying" ? "Verificando tu identidad…" : "Enviando regularización…"}
                </DialogTitle>
                <DialogDescription>
                  {phase === "verifying"
                    ? "Confirma la operación con tu passkey o MFA."
                    : "Estamos generando el nuevo registro y enviándolo a AEAT. No cierres esta ventana."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-4 text-sm">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span>
                  {phase === "verifying" ? "Esperando verificación…" : "Contactando con AEAT…"}
                </span>
              </div>
            </>
          ) : null}

          {phase === "success" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  Regularización aceptada
                </DialogTitle>
                <DialogDescription>{message}</DialogDescription>
              </DialogHeader>
              {csv ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <span className="text-muted-foreground">CSV AEAT</span>
                  <p className="mt-1 break-all font-mono text-xs">{csv}</p>
                </div>
              ) : null}
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}

          {phase === "error" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-destructive" />
                  No se pudo completar la regularización
                </DialogTitle>
                <DialogDescription className="wrap-break-word whitespace-pre-wrap">
                  {message ?? "Se produjo un error sin detalle."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
