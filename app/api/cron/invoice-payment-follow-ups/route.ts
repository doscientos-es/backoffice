import { type NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { serverEnv } from "@/lib/env";
import { processDueInvoicePaymentFollowUps } from "@/lib/invoices/process-payment-follow-ups";
import { scopedLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("cron.invoice-payment-follow-ups");

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request, [serverEnv().CRON_SECRET])) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueInvoicePaymentFollowUps();
    log.info(result, "invoice payment follow-ups cron executed");
    return NextResponse.json(result, { status: result.failed > 0 ? 207 : 200 });
  } catch (error) {
    log.error({ err: error }, "invoice payment follow-ups cron failed");
    return NextResponse.json({ error: "invoice_payment_follow_ups_failed" }, { status: 500 });
  }
}
