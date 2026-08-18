import { createVerifactuClient } from "@doscientos/verifactu";
import { verifactuConfigFromEnv } from "./config";

const DIAGNOSTIC_TTL_DAYS = 7;

type DiagnosticCheck = { key: string; ok: boolean; detail: string };

export type VerifactuDiagnosticGate = {
  status: "missing" | "expired" | "failed" | "passed";
  ranAt: string | null;
  expiresAt: string | null;
};

type DiagnosticRun = {
  status: "passed" | "failed";
  expires_at: string;
  created_at: string;
};

async function createDiagnosticAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function gateFromRun(run: DiagnosticRun | null): VerifactuDiagnosticGate {
  if (!run) return { status: "missing", ranAt: null, expiresAt: null };
  if (run.status !== "passed") {
    return { status: "failed", ranAt: run.created_at, expiresAt: run.expires_at };
  }
  return {
    status: new Date(run.expires_at).getTime() > Date.now() ? "passed" : "expired",
    ranAt: run.created_at,
    expiresAt: run.expires_at,
  };
}

export async function getVerifactuDiagnosticGate(): Promise<VerifactuDiagnosticGate> {
  const admin = await createDiagnosticAdminClient();
  const { data, error } = await admin
    .from("verifactu_diagnostic_runs")
    .select("status, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No se pudo consultar el diagnóstico VERI*FACTU: ${error.message}`);
  return gateFromRun(data as DiagnosticRun | null);
}

export async function assertVerifactuDiagnosticGate(): Promise<void> {
  const gate = await getVerifactuDiagnosticGate();
  if (gate.status !== "passed") {
    throw new Error(
      "La suite sintética VERI*FACTU debe completarse correctamente en Ajustes > Diagnóstico antes de emitir o anular facturas.",
    );
  }
}

export async function runVerifactuMockDiagnostic(memberId: string): Promise<{
  ok: boolean;
  detail: string;
}> {
  const now = new Date();
  const testNumber = `DIAG-${now.toISOString().slice(0, 10).replaceAll("-", "")}`;
  let checks: DiagnosticCheck[];
  try {
    const config = verifactuConfigFromEnv();
    const client = createVerifactuClient({ ...config, environment: "mock" });
    const result = await client.registerInvoice({
      nif: "B12345678",
      invoiceNumber: testNumber,
      invoiceType: "F1",
      issueDate: now,
      taxAmount: 21,
      total: 121,
      previousHash: null,
      generatedAt: now,
      emisorName: "Emisor de prueba VERI*FACTU",
      clientNif: "B87654321",
      clientName: "Destinatario de prueba VERI*FACTU",
      descriptionOperacion: "Diagnóstico sintético VERI*FACTU; no es una factura.",
      vatLines: [{ rate: 21, base: 100, tax: 21 }],
      previousInvoiceNumber: null,
      previousIssueDate: null,
    });
    const qrUrl = client.buildQrUrl({
      nif: "B12345678",
      invoiceNumber: testNumber,
      issueDate: now,
      total: 121,
    });
    checks = [
      { key: "sif_config", ok: true, detail: "Configuración SIF válida" },
      {
        key: "xml_xsd_hash",
        ok: result.status === "accepted" && /^[A-F0-9]{64}$/.test(result.hash),
        detail: result.errorMessage ?? "XML, XSD y huella SHA-256 válidos",
      },
      {
        key: "mock_delivery",
        ok: result.status === "accepted" && result.response.mock === true,
        detail: result.errorMessage ?? "Entrega mock aceptada sin conexión a AEAT",
      },
      { key: "qr", ok: Boolean(qrUrl), detail: "URL QR de verificación generada" },
    ];
  } catch {
    checks = [
      {
        key: "sif_config",
        ok: false,
        detail: "La configuración SIF no permite completar la suite sintética",
      },
    ];
  }
  const ok = checks.every((check) => check.ok);
  const admin = await createDiagnosticAdminClient();
  const { error } = await admin.from("verifactu_diagnostic_runs").insert({
    status: ok ? "passed" : "failed",
    checks,
    created_by: memberId,
    expires_at: new Date(now.getTime() + DIAGNOSTIC_TTL_DAYS * 86_400_000).toISOString(),
  });
  if (error) throw new Error(`No se pudo guardar el diagnóstico VERI*FACTU: ${error.message}`);
  return {
    ok,
    detail: ok
      ? `Suite VERI*FACTU superada. Habilita facturación durante ${DIAGNOSTIC_TTL_DAYS} días.`
      : "La suite VERI*FACTU falló; la facturación real permanece bloqueada.",
  };
}
