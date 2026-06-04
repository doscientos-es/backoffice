import { getCurrentUser } from "@/lib/auth";
import { renderInvoicePdf } from "@/lib/invoices/invoice-pdf-document";
import { buildInvoicePdfData, invoicePdfFilename } from "@/lib/invoices/pdf-data";
import { isPortalUnlocked } from "@/lib/portal/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public portal invoice PDF download. Enforces the exact same visibility and
 * password gate as the HTML portal page: hidden invoices 404, password-locked
 * ones redirect to the unlock form, and logged-in team members always pass.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("*, clients(name)")
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice || invoice.status === "draft") {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  const auth = await getCurrentUser();
  if (!auth.ok) {
    if ((invoice.is_client_visible as boolean | null) === false) {
      return NextResponse.json({ error: "Factura no disponible" }, { status: 404 });
    }
    const unlocked = await isPortalUnlocked(
      token,
      (invoice.portal_password_hash as string | null) ?? null,
    );
    if (!unlocked) {
      return NextResponse.redirect(new URL(`/p/invoice/${token}`, req.url));
    }
  }

  const [{ data: items }, { data: settings }] = await Promise.all([
    admin
      .from("invoice_items")
      .select("description, quantity, unit_price, vat_rate, subtotal")
      .eq("invoice_id", invoice.id as string)
      .order("position"),
    admin.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const clientName =
    (invoice as unknown as { clients: { name: string } | null }).clients?.name ?? null;

  const data = await buildInvoicePdfData({
    invoice: {
      full_number: (invoice.full_number as string | null) ?? null,
      invoice_type: (invoice.invoice_type as string | null) ?? null,
      status: (invoice.status as string | null) ?? null,
      issue_date: (invoice.issue_date as string | null) ?? null,
      due_date: (invoice.due_date as string | null) ?? null,
      idfact: (invoice.idfact as string | null) ?? null,
      verifactu_csv: (invoice.verifactu_csv as string | null) ?? null,
      subtotal: invoice.subtotal == null ? null : Number(invoice.subtotal),
      total: invoice.total == null ? null : Number(invoice.total),
      client_nif: (invoice.client_nif as string | null) ?? null,
    },
    clientName,
    items: (items ?? []) as Array<{
      description: string | null;
      quantity: number | null;
      unit_price: number | null;
      vat_rate: number | null;
      subtotal: number | null;
    }>,
    settings: settings
      ? {
          company_name: (settings.company_name as string | null) ?? null,
          company_nif: (settings.company_nif as string | null) ?? null,
          company_address: (settings.company_address as string | null) ?? null,
          iban: (settings.iban as string | null) ?? null,
        }
      : null,
  });

  const pdf = await renderInvoicePdf(data);
  const filename = invoicePdfFilename(invoice.full_number as string | null, invoice.id as string);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
