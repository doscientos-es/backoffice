import { verifactuDiagnosticConfigFromEnv } from "./config";

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

const SAFE_SIF_CONFIGURATION_ERRORS = new Set([
  "VERIFACTU_PRODUCER_NIF es obligatorio para operar con VERI*FACTU",
  "El certificado P12 de VERI*FACTU es obligatorio para conectar con AEAT",
  "VERIFACTU_CERT_EXPIRES_AT es obligatorio para conectar con AEAT",
  "El certificado P12 de VERI*FACTU está caducado o tiene una fecha inválida",
  "Los datos fiscales de la empresa (NIF y razón social) son obligatorios para ejecutar el diagnóstico VERI*FACTU",
  "No se pudieron consultar los datos fiscales de la empresa",
]);

function safeSifConfigurationDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (SAFE_SIF_CONFIGURATION_ERRORS.has(message)) return message;
  return "La configuración SIF no permite completar la suite sintética";
}

async function createDiagnosticAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

async function findDiagnosticIssuer(): Promise<{ nif: string; name: string }> {
  const admin = await createDiagnosticAdminClient();
  const { data, error } = await admin
    .from("settings")
    .select("company_nif, company_name")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("No se pudieron consultar los datos fiscales de la empresa");

  const nif = (data?.company_nif ?? "").trim();
  const name = (data?.company_name ?? "").trim();
  if (!nif || !name) {
    throw new Error(
      "Los datos fiscales de la empresa (NIF y razón social) son obligatorios para ejecutar el diagnóstico VERI*FACTU",
    );
  }
  return { nif, name };
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

export async function runVerifactuAeatTestDiagnostic(memberId: string): Promise<{
  ok: boolean;
  detail: string;
}> {
  const now = new Date();
  const testNumber = `DIAG-${now.toISOString().replace(/[-:.TZ]/g, "")}`;
  let checks: DiagnosticCheck[];
  try {
    const config = verifactuDiagnosticConfigFromEnv();
    const issuer = await findDiagnosticIssuer();
    const { createVerifactuClient } = await import("@doscientos/verifactu");
    const client = createVerifactuClient(config);
    const result = await client.registerInvoice({
      nif: issuer.nif,
      invoiceNumber: testNumber,
      invoiceType: "F1",
      issueDate: now,
      taxAmount: 21,
      total: 121,
      previousHash: null,
      generatedAt: now,
      emisorName: issuer.name,
      clientNif: null,
      clientName: null,
      descriptionOperacion: "Diagnóstico sintético VERI*FACTU; no es una factura.",
      vatLines: [{ rate: 21, base: 100, tax: 21 }],
      previousInvoiceNumber: null,
      previousIssueDate: null,
    });
    const qrUrl = client.buildQrUrl({
      nif: issuer.nif,
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
        key: "aeat_test_delivery",
        ok: result.status === "accepted",
        detail: result.errorMessage ?? "Entrega aceptada por la AEAT de pruebas",
      },
      { key: "qr", ok: Boolean(qrUrl), detail: "URL QR de verificación generada" },
    ];
  } catch (error) {
    checks = [
      {
        key: "sif_config",
        ok: false,
        detail: safeSifConfigurationDetail(error),
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
      : `La suite VERI*FACTU falló: ${checks.find((check) => !check.ok)?.detail ?? "comprobación no superada"}. La facturación real permanece bloqueada.`,
  };
}
