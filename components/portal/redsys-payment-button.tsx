"use client";

import { type PaymentMode, initiatePayment } from "@/app/p/invoice/[token]/actions";
import { Button } from "@/components/ui/button";
import { formatEUR } from "@/lib/utils";
import { CreditCard, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

interface RedsysPaymentButtonProps {
  invoiceId: string;
  token: string;
  total: number;
  /** Sum of already-confirmed payments in EUR. */
  amountPaid: number;
}

export function RedsysPaymentButton({
  invoiceId,
  token,
  total,
  amountPaid,
}: RedsysPaymentButtonProps) {
  const hasPartial = amountPaid > 0;
  const amountDue = Math.round((total - amountPaid) * 100) / 100;
  const depositAmount = Math.round(total * 50) / 100;

  const [mode, setMode] = useState<PaymentMode>(hasPartial ? "remainder" : "full");
  const [isPending, startTransition] = useTransition();

  const handlePay = () => {
    startTransition(async () => {
      const result = await initiatePayment(invoiceId, mode, token);
      if (!result.ok) {
        window.location.href = `/p/invoice/${token}?error=1`;
        return;
      }
      // Dynamically build and submit the Redsys form
      const form = document.createElement("form");
      form.method = "POST";
      form.action = result.url;
      form.style.display = "none";
      for (const [name, value] of Object.entries({
        Ds_SignatureVersion: result.signatureVersion,
        Ds_MerchantParameters: result.merchantParameters,
        Ds_Signature: result.signature,
      })) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full sm:w-auto">
      {hasPartial ? (
        <p className="text-sm text-zinc-400">
          Pagado: <strong className="text-emerald-400">{formatEUR(amountPaid)}</strong>
          {" · "}
          Pendiente: <strong className="text-white">{formatEUR(amountDue)}</strong>
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="payment-mode"
              value="full"
              checked={mode === "full"}
              onChange={() => setMode("full")}
              className="accent-white"
            />
            <span className="text-sm text-zinc-200">
              Pagar total <strong className="text-white">{formatEUR(total)}</strong>
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="payment-mode"
              value="deposit"
              checked={mode === "deposit"}
              onChange={() => setMode("deposit")}
              className="accent-white"
            />
            <span className="text-sm text-zinc-400">
              Pagar señal (50%){" "}
              <strong className="text-zinc-300">{formatEUR(depositAmount)}</strong>
            </span>
          </label>
        </div>
      )}

      <Button
        type="button"
        onClick={handlePay}
        disabled={isPending}
        size="lg"
        className="w-full sm:w-auto font-semibold"
      >
        {isPending ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-5 w-5" />
        )}
        {isPending ? "Preparando pago…" : "Pagar con Tarjeta o Bizum"}
      </Button>
    </div>
  );
}
