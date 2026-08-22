import { serverEnv } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";
import { getVerifactuDiagnosticGate, type VerifactuDiagnosticGate } from "./diagnostics";

const DAY_MS = 86_400_000;

export type CertificateHealth = {
  status: "ok" | "warning" | "expired" | "missing";
  expiresAt: string | null;
  daysRemaining: number | null;
};

export type VerifactuOperationalHealth = {
  queueAvailable: boolean;
  pending: number;
  retrying: number;
  blocked: number;
  diagnostic: VerifactuDiagnosticGate | { status: "unavailable"; ranAt: null; expiresAt: null };
  certificate: CertificateHealth;
};

export function getCertificateHealth(
  value: string | undefined,
  now = new Date(),
): CertificateHealth {
  if (!value) return { status: "missing", expiresAt: null, daysRemaining: null };
  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    return { status: "missing", expiresAt: null, daysRemaining: null };
  }
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
  return {
    status:
      expiresAt.getTime() <= now.getTime()
        ? "expired"
        : daysRemaining <= 30
          ? "warning"
          : "ok",
    expiresAt: value,
    daysRemaining,
  };
}

export async function getVerifactuOperationalHealth(): Promise<VerifactuOperationalHealth> {
  const supabase = await createServerClient();
  const [pending, retrying, blocked, diagnostic] = await Promise.all([
    supabase
      .from("verifactu_outbox")
      .select("id", { count: "exact", head: true })
      .in("state", ["queued", "processing"]),
    supabase
      .from("verifactu_outbox")
      .select("id", { count: "exact", head: true })
      .eq("state", "retryable_error"),
    supabase
      .from("verifactu_outbox")
      .select("id", { count: "exact", head: true })
      .in("state", ["rejected", "terminal_error"]),
    getVerifactuDiagnosticGate().catch(
      () => ({ status: "unavailable", ranAt: null, expiresAt: null }) as const,
    ),
  ]);
  const queueAvailable = !pending.error && !retrying.error && !blocked.error;

  return {
    queueAvailable,
    pending: pending.count ?? 0,
    retrying: retrying.count ?? 0,
    blocked: blocked.count ?? 0,
    diagnostic,
    certificate: getCertificateHealth(serverEnv().VERIFACTU_CERT_EXPIRES_AT),
  };
}
