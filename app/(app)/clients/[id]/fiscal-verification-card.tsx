"use client";

import { CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { validateClientFiscalIdentity } from "../actions";

type FiscalStatus =
  | "unverified"
  | "verified"
  | "mismatch"
  | "unavailable"
  | "invalid"
  | "not_applicable";

const labels: Record<FiscalStatus, string> = {
  unverified: "Pendiente de validación AEAT",
  verified: "Identificado por AEAT",
  mismatch: "No coincide con el censo AEAT",
  unavailable: "AEAT no disponible o sin autorización",
  invalid: "Datos fiscales no válidos",
  not_applicable: "No aplicable a VNifV2",
};

export function FiscalVerificationCard({
  clientId,
  initialStatus,
}: {
  clientId: string;
  initialStatus: FiscalStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const verified = status === "verified";

  async function validate() {
    setPending(true);
    const result = await validateClientFiscalIdentity({ clientId });
    setPending(false);
    if (!result.ok) return setMessage(result.error);
    setStatus(result.status);
    setMessage(result.message);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-start gap-2">
        {verified ? (
          <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
        ) : (
          <ShieldAlert className="mt-0.5 size-5 text-amber-600" />
        )}
        <div>
          <p className="font-medium">Identificación fiscal</p>
          <p className="text-sm text-muted-foreground">{labels[status]}</p>
        </div>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div>
        <Button
          type="button"
          size="sm"
          variant={verified ? "outline" : "default"}
          onClick={validate}
          disabled={pending}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Validar con AEAT
        </Button>
      </div>
    </div>
  );
}
