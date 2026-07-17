"use server";

import { isDemoMode } from "@/lib/demo";
import { publicEnv, serverEnv } from "@/lib/env";
import { createRedsysPayment, getRedsysUrl } from "@/lib/integrations/redsys";
import { unlockPortalResource } from "@/lib/portal/access";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Public unlock-form submit for a password-protected invoice portal link. */
export async function unlockInvoicePortal(input: unknown): Promise<ActionResult> {
  return unlockPortalResource("invoices", input);
}

export type PaymentMode = "full" | "deposit" | "remainder";

export type PaymentInitResult =
  | {
      ok: true;
      demo?: boolean;
      url: string;
      signatureVersion: string;
      merchantParameters: string;
      signature: string;
    }
  | { ok: false; error: string };

/**
 * Initiates a Redsys payment for an invoice.
 * Creates a pending `invoice_payments` row whose `seq`-derived `redsys_order`
 * guarantees uniqueness across retries and partial-payment scenarios.
 */
export async function initiatePayment(
  invoiceId: string,
  mode: PaymentMode,
  token: string,
): Promise<PaymentInitResult> {
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("id, status, total, number")
    .eq("id", invoiceId)
    .eq("portal_token", token)
    .maybeSingle();

  if (!invoice || !["issued", "overdue"].includes(invoice.status as string)) {
    return { ok: false, error: "Invoice not payable" };
  }

  const invoiceTotal = Number(invoice.total);

  // Compute amount based on mode
  let amount: number;
  if (mode === "full") {
    amount = invoiceTotal;
  } else if (mode === "deposit") {
    amount = Math.round(invoiceTotal * 50) / 100; // 50%
  } else {
    // remainder: total minus already-confirmed payments
    const { data: confirmed } = await admin
      .from("invoice_payments")
      .select("amount")
      .eq("invoice_id", invoiceId)
      .eq("status", "confirmed");
    const paid = confirmed?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
    amount = Math.round((invoiceTotal - paid) * 100) / 100;
    if (amount <= 0) return { ok: false, error: "Invoice already fully paid" };
  }

  // Insert pending payment row — seq auto-increments and redsys_order is generated
  const { data: payment, error: insertError } = await admin
    .from("invoice_payments")
    .insert({ invoice_id: invoiceId, amount })
    .select("redsys_order")
    .single();

  if (insertError || !payment?.redsys_order) {
    return { ok: false, error: "Failed to create payment record" };
  }

  if (isDemoMode()) {
    const { error: confirmError } = await admin
      .from("invoice_payments")
      .update({
        status: "confirmed",
        ds_response: "0000",
        ds_authorisation_code: "DEMO-0001",
        confirmed_at: new Date().toISOString(),
      })
      .eq("redsys_order", payment.redsys_order as string);

    if (confirmError) return { ok: false, error: "Failed to simulate payment" };

    const shouldMarkPaid = mode !== "deposit" && amount >= invoiceTotal;
    if (shouldMarkPaid) {
      const { error: invoiceError } = await admin
        .from("invoices")
        .update({
          status: "paid",
          payment_method: "card",
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
      if (invoiceError) return { ok: false, error: "Failed to update demo invoice" };
    }

    return {
      ok: true,
      demo: true,
      url: `${publicEnv.NEXT_PUBLIC_APP_URL}/p/invoice/${token}?success=1`,
      signatureVersion: "DEMO",
      merchantParameters: "",
      signature: "",
    };
  }

  const env = serverEnv();
  const amountCents = Math.round(amount * 100).toString();

  const redsysData = createRedsysPayment({
    Ds_Merchant_Amount: amountCents,
    Ds_Merchant_Order: payment.redsys_order as string,
    Ds_Merchant_MerchantCode: env.REDSYS_MERCHANT_CODE,
    Ds_Merchant_Terminal: env.REDSYS_TERMINAL,
    Ds_Merchant_Currency: env.REDSYS_CURRENCY,
    Ds_Merchant_TransactionType: "0",
    Ds_Merchant_MerchantURL: `${publicEnv.NEXT_PUBLIC_APP_URL}/api/webhooks/redsys`,
    Ds_Merchant_UrlOK: `${publicEnv.NEXT_PUBLIC_APP_URL}/p/invoice/${token}?success=1`,
    Ds_Merchant_UrlKO: `${publicEnv.NEXT_PUBLIC_APP_URL}/p/invoice/${token}?error=1`,
    Ds_Merchant_MerchantData: invoiceId,
  });

  return {
    ok: true,
    url: getRedsysUrl(),
    signatureVersion: redsysData.Ds_SignatureVersion,
    merchantParameters: redsysData.Ds_MerchantParameters,
    signature: redsysData.Ds_Signature,
  };
}
