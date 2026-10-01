"use server";

import { z } from "zod";

import { QuarterlyAdvisorEmail } from "@/components/email";
import { defineAction } from "@/lib/actions/define-action";
import { externalAppUrl } from "@/lib/email/app-url";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { publicEnv } from "@/lib/env";
import {
  lastDayOf,
  loadQuarterlyAdvisorData,
  quarterlyAdvisorFilename,
  quarterlyAdvisorWorkbook,
  quarterlyTotals,
} from "@/lib/exports/quarterly-advisor";
import { expenseArchiveFilename, quarterlyPeriod } from "@/lib/exports/quarterly-invoices";
import { madridToday, QUARTERLY_ADVISOR_EMAIL } from "@/lib/finance/quarterly-handoff";
import { buildInvoicePdfAttachment } from "@/lib/invoices/pdf-attachment";
import { scopedLogger } from "@/lib/logger";
import { getStorage } from "@/lib/storage";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";

const log = scopedLogger("finance.quarterlyAdvisor");

// Resend caps the whole message at 40 MB after base64 encoding (~4/3 overhead).
const MAX_ATTACHMENT_BYTES = 28 * 1024 * 1024;

const SendQuarterlyAdvisorInput = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  quarter: z.coerce.number().int().min(1).max(4),
  to: z.string().trim().email().default(QUARTERLY_ADVISOR_EMAIL),
  message: z.string().trim().max(2000).optional(),
  attachDocuments: z.boolean().default(true),
});

type Attachment = { filename: string; content: Buffer };

/** Emails the quarter's Excel register plus invoice PDFs and expense documents to the advisor. */
export const sendQuarterlyAdvisorEmail = defineAction<
  typeof SendQuarterlyAdvisorInput,
  { mocked: boolean; attachments: number; skipped: string[] }
>({
  name: "finance.sendQuarterlyAdvisorEmail",
  schema: SendQuarterlyAdvisorInput,
  roles: ["owner", "admin"],
  revalidate: ["/finance"],
  handler: async ({ year, quarter, to, message, attachDocuments }, { user }) => {
    const period = quarterlyPeriod(String(year), String(quarter));
    if (!period) throw new Error("Trimestre no válido");
    if (madridToday() < period.end) {
      throw new Error(
        `El ${period.label} aún no ha cerrado; podrás enviarlo a partir del ${formatDate(period.end)}.`,
      );
    }

    const data = await loadQuarterlyAdvisorData(period);
    const attachments: Attachment[] = [
      { filename: quarterlyAdvisorFilename(period, "xlsx"), content: quarterlyAdvisorWorkbook(data) },
    ];
    const skipped: string[] = [];
    let usedBytes = attachments[0]?.content.length ?? 0;
    const tryAttach = (attachment: Attachment) => {
      if (usedBytes + attachment.content.length > MAX_ATTACHMENT_BYTES) {
        skipped.push(attachment.filename);
        return;
      }
      usedBytes += attachment.content.length;
      attachments.push(attachment);
    };

    if (attachDocuments) {
      for (const invoice of data.invoices) {
        try {
          tryAttach(await buildInvoicePdfAttachment(invoice.id));
        } catch (error) {
          log.warn({ err: error, invoiceId: invoice.id }, "quarterly_invoice_pdf_failed");
          skipped.push(invoice.full_number ?? invoice.id);
        }
      }
      const expensesById = new Map(data.expenses.map((expense) => [expense.id, expense]));
      for (const attachment of data.attachments) {
        const expense = expensesById.get(attachment.expense_id);
        if (!expense || !attachment.storage_path) continue;
        const filename = expenseArchiveFilename({
          id: attachment.id ?? attachment.expense_id,
          date: expense.expense_date,
          vendor: expense.vendor,
          reference: expense.invoice_reference,
          name: attachment.name,
        });
        if (usedBytes + Number(attachment.size_bytes ?? 0) > MAX_ATTACHMENT_BYTES) {
          skipped.push(filename);
          continue;
        }
        const { data: file, error } = await getStorage().download("documents", attachment.storage_path);
        if (error || !file) {
          log.warn({ err: error, attachmentId: attachment.id }, "quarterly_expense_file_failed");
          skipped.push(filename);
          continue;
        }
        tryAttach({ filename, content: Buffer.from(file) });
      }
    }

    const totals = quarterlyTotals(data);
    const documentCount = attachments.length - 1;
    const result = await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias ?? "facturacion",
      replyTo: user.contactEmail ?? user.email,
      to,
      subject: `Documentación fiscal ${period.label} · doscientos`,
      html: await renderEmail(
        QuarterlyAdvisorEmail({
          quarterLabel: period.label,
          periodLabel: `${formatDate(period.start)} – ${formatDate(lastDayOf(period))}`,
          invoiceCount: totals.invoices.count,
          invoiceTotal: formatEUR(totals.invoices.total),
          expenseCount: totals.expenses.count,
          expenseTotal: formatEUR(totals.expenses.total),
          attachmentCount: documentCount,
          skippedFiles: skipped,
          message: message || undefined,
          appUrl: externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL),
        }),
      ),
      attachments,
      tags: { kind: "quarterly_advisor", quarter: `${year}-T${quarter}`, sent_by: user.id },
    });

    const supabase = await createServerClient();
    const { error } = await supabase.from("quarterly_advisor_deliveries").insert({
      year,
      quarter,
      recipient: to,
      invoice_count: totals.invoices.count,
      expense_count: totals.expenses.count,
      attached_pdfs: documentCount,
      provider_message_id: result.id,
      mocked: result.mocked,
      sent_by: user.id,
    });
    if (error) log.error({ err: error, quarter: period.label }, "quarterly_delivery_log_failed");

    log.info({ quarter: period.label, attachments: documentCount, skipped: skipped.length }, "quarterly_advisor_sent");
    return { mocked: result.mocked, attachments: documentCount, skipped };
  },
});
