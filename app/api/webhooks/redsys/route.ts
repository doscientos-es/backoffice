import { PaymentReceiptEmail } from "@/components/email";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { publicEnv } from "@/lib/env";
import {
  isRedsysSuccess,
  parseRedsysResponse,
  verifyRedsysSignature,
} from "@/lib/integrations/redsys";
import { createDepositInvoice } from "@/lib/invoices/create-deposit-invoice";
import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatEUR } from "@/lib/utils";

const log = scopedLogger("api.webhooks.redsys");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const merchantParameters = formData.get("Ds_MerchantParameters") as string;
    const signature = formData.get("Ds_Signature") as string;

    if (!merchantParameters || !signature) {
      log.warn("Missing parameters or signature");
      return new Response("Missing parameters", { status: 400 });
    }

    const isValid = verifyRedsysSignature(merchantParameters, signature);
    if (!isValid) {
      log.error({ signature, merchantParameters }, "invalid_signature");
      return new Response("Invalid signature", { status: 403 });
    }

    const responseData = parseRedsysResponse(merchantParameters);
    const orderId = responseData.Ds_Order || responseData.Ds_Merchant_Order;
    const responseCode = responseData.Ds_Response;
    const amount = responseData.Ds_Amount;
    const invoiceId = responseData.Ds_MerchantData;

    log.info({ orderId, responseCode, amount, invoiceId }, "redsys_notification_received");

    const supabase = createAdminClient();

    if (isRedsysSuccess(responseCode)) {
      // Locate the pending payment record by Redsys order ID
      const { data: payment, error: paymentFindError } = await supabase
        .from("invoice_payments")
        .select("id, invoice_id, proposal_id, amount")
        .eq("redsys_order", orderId)
        .maybeSingle();

      if (paymentFindError || !payment) {
        log.error({ orderId, paymentFindError }, "payment_record_not_found");
        return new Response("Payment record not found", { status: 404 });
      }

      // Confirm the payment
      const { error: confirmError } = await supabase
        .from("invoice_payments")
        .update({
          status: "confirmed",
          ds_response: responseCode?.toString() ?? null,
          ds_authorisation_code: responseData.Ds_AuthorisationCode ?? null,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      if (confirmError) {
        log.error({ err: confirmError.message, paymentId: payment.id }, "confirm_payment_failed");
        return new Response("Update failed", { status: 500 });
      }

      log.info({ paymentId: payment.id, orderId, amount: payment.amount }, "payment_confirmed");

      // Handle Invoice payment
      if (payment.invoice_id) {
        // Sum all confirmed payments and mark invoice paid when total is reached
        const { data: confirmed } = await supabase
          .from("invoice_payments")
          .select("amount")
          .eq("invoice_id", payment.invoice_id as string)
          .eq("status", "confirmed");

        const totalPaid = confirmed?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;

        const { data: invoice } = await supabase
          .from("invoices")
          .select("id, status, total, full_number")
          .eq("id", payment.invoice_id as string)
          .maybeSingle();

        if (!invoice) {
          log.error({ invoiceId: payment.invoice_id }, "invoice_not_found_after_payment");
        } else {
          const isFullyPaid = totalPaid >= Number(invoice.total) - 0.01;

          if (invoice.status !== "paid" && isFullyPaid) {
            await supabase
              .from("invoices")
              .update({ status: "paid", paid_at: new Date().toISOString(), payment_method: "card" })
              .eq("id", invoice.id);
            log.info({ invoiceId: invoice.id, totalPaid }, "invoice_marked_as_paid");
          }

          // Notify the team
          const { data: recipients } = await supabase
            .from("team_members")
            .select("id")
            .in("role", ["owner", "admin"])
            .is("deleted_at", null);

          if (recipients?.length) {
            const due = Math.round((Number(invoice.total) - totalPaid) * 100) / 100;
            const fullNumber = invoice.full_number as string;
            const body = isFullyPaid
              ? `Factura ${fullNumber} cobrada \u2014 ${formatEUR(totalPaid)}`
              : `Pago parcial de ${fullNumber} \u2014 ${formatEUR(Number(payment.amount))} (pendiente ${formatEUR(due)})`;

            await supabase.from("notifications").insert(
              recipients.map((r) => ({
                recipient_id: r.id as string,
                actor_id: null,
                event_type: isFullyPaid ? "invoice_paid" : "invoice_payment",
                entity_type: "invoice",
                entity_id: invoice.id as string,
                body,
                link: `/invoices/${invoice.id}`,
              })),
            );
          }
        }
      }

      // Handle Proposal payment (deposit)
      if (payment.proposal_id) {
        // Auto-generate a draft deposit invoice (best-effort — must not block the webhook)
        const depositResult = await createDepositInvoice(
          supabase,
          payment.proposal_id as string,
          Number(payment.amount),
        );
        if (depositResult.ok) {
          // Link the payment to the newly created invoice
          await supabase
            .from("invoice_payments")
            .update({ invoice_id: depositResult.invoiceId })
            .eq("id", payment.id);
          log.info(
            { paymentId: payment.id, invoiceId: depositResult.invoiceId },
            "deposit_invoice_created",
          );
        } else {
          log.error(
            { paymentId: payment.id, err: depositResult.error },
            "deposit_invoice_creation_failed",
          );
        }

        const { data: proposal } = await supabase
          .from("proposals")
          .select(
            "id, number, title, portal_token, clients(name, email), leads(name, company, email)",
          )
          .eq("id", payment.proposal_id as string)
          .maybeSingle();

        if (proposal) {
          // Notify the team
          const { data: recipients } = await supabase
            .from("team_members")
            .select("id")
            .in("role", ["owner", "admin"])
            .is("deleted_at", null);

          if (recipients?.length) {
            const body = `Se\u00f1al recibida: ${proposal.number} \u2014 ${formatEUR(Number(payment.amount))}`;

            await supabase.from("notifications").insert(
              recipients.map((r) => ({
                recipient_id: r.id as string,
                actor_id: null,
                event_type: "invoice_payment", // Reuse icon/tone
                entity_type: "proposal",
                entity_id: proposal.id as string,
                body,
                link: `/proposals/${proposal.id}`,
              })),
            );
          }

          // Email the client a link to the payment receipt (best-effort: a
          // failure here must never turn the webhook into a non-200 response).
          const client = (
            proposal as unknown as {
              clients: { name: string | null; email: string | null } | null;
            }
          ).clients;
          const lead = (
            proposal as unknown as {
              leads: { name: string | null; company: string | null; email: string | null } | null;
            }
          ).leads;
          const recipientEmail = client?.email ?? lead?.email ?? null;
          const portalToken = proposal.portal_token as string | null;

          if (recipientEmail && portalToken) {
            try {
              const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
              const html = await renderEmail(
                PaymentReceiptEmail({
                  clientName: client?.name ?? lead?.company ?? lead?.name ?? "Hola",
                  proposalNumber: proposal.number as string,
                  proposalTitle: proposal.title as string,
                  amount: formatEUR(Number(payment.amount)),
                  paymentDate: formatDate(new Date().toISOString()),
                  reference: orderId ?? "",
                  receiptUrl: `${appUrl}/p/proposal/${portalToken}/receipt/${payment.id}`,
                  appUrl,
                }),
              );
              await sendEmail({
                fromName: "doscientos",
                fromAlias: "notificaciones",
                to: recipientEmail,
                subject: `Pago confirmado \u00b7 ${proposal.number}`,
                html,
                tags: { proposal_id: proposal.id as string, type: "payment_receipt" },
              });
              log.info({ paymentId: payment.id, proposalId: proposal.id }, "receipt_email_sent");
            } catch (e) {
              log.error(
                { err: e instanceof Error ? e.message : String(e), paymentId: payment.id },
                "receipt_email_failed",
              );
            }
          }
        }
      }
    } else {
      // Mark the payment as failed
      if (orderId) {
        await supabase
          .from("invoice_payments")
          .update({ status: "failed", ds_response: responseCode?.toString() ?? null })
          .eq("redsys_order", orderId);
      }
      log.warn({ orderId, responseCode }, "payment_failed_or_rejected");
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "webhook_error");
    return new Response("Internal Error", { status: 500 });
  }
}
