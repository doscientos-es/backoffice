"use client";

import { CreditCard, LoaderCircle as Loader2 } from "lucide-react";
import { useTransition } from "react";

import { initiatePayment } from "@/app/p/invoice/[token]/actions";
import { Button } from "@/components/ui/button";
import { formatPortalEUR } from "@/lib/portal/language";

interface RedsysPaymentButtonProps {
  invoiceId: string;
  token: string;
  total: number;
  /** Sum of already-confirmed payments in EUR. */
  amountPaid: number;
  language?: "es" | "ca" | "en";
}

export function RedsysPaymentButton({
  invoiceId,
  token,
  total,
  amountPaid,
  language = "es",
}: RedsysPaymentButtonProps) {
  const copy =
    language === "ca"
      ? {
          paid: "Pagat:",
          due: "Pendent:",
          full: "Es cobrarà l’import total d’aquesta factura:",
          waiting: "Preparant el pagament…",
          pay: "Pagar",
          with: "amb targeta o Bizum",
        }
      : language === "en"
        ? {
            paid: "Paid:",
            due: "Due:",
            full: "The full invoice amount will be charged:",
            waiting: "Preparing payment…",
            pay: "Pay",
            with: "by card or Bizum",
          }
        : {
            paid: "Pagado:",
            due: "Pendiente:",
            full: "Se cobrará el importe completo de esta factura:",
            waiting: "Preparando pago…",
            pay: "Pagar",
            with: "con Tarjeta o Bizum",
          };
  const money = (amount: number) => formatPortalEUR(amount, language);
  const amountDue = Math.round((total - amountPaid) * 100) / 100;
  const [isPending, startTransition] = useTransition();

  const handlePay = () => {
    startTransition(async () => {
      const result = await initiatePayment(invoiceId, token);
      if (!result.ok) {
        window.location.href = `/p/invoice/${token}?error=1&lang=${language}`;
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
    <div className="flex w-full flex-col gap-4 sm:w-auto">
      {amountPaid > 0 ? (
        <p className="text-sm text-zinc-400">
          {copy.paid} <strong className="text-emerald-400">{money(amountPaid)}</strong>
          {" · "}
          {copy.due} <strong className="text-white">{money(amountDue)}</strong>
        </p>
      ) : (
        <p className="text-sm text-zinc-400">
          {copy.full} <strong className="text-white">{money(amountDue)}</strong>
        </p>
      )}

      <Button
        type="button"
        onClick={handlePay}
        disabled={isPending}
        size="lg"
        className="w-full font-semibold sm:w-auto"
      >
        {isPending ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-5 w-5" />
        )}
        {isPending ? copy.waiting : `${copy.pay} ${money(amountDue)} ${copy.with}`}
      </Button>
    </div>
  );
}
