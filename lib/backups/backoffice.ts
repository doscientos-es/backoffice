import "server-only";

import { isDemoMode } from "@/lib/demo";
import { publicEnv, serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";

export const BACKOFFICE_BACKUP_SLUG = "doscientos-backoffice";

const log = scopedLogger("backoffice-backup");

export type BackofficeBackupEnvironment = {
  BACKUP_RUNNER_URL: string;
  BACKUP_RUNNER_TOKEN: string;
  BACKUP_DB_HOST: string;
  BACKUP_DB_PORT: number;
  BACKUP_DB_NAME: string;
  BACKUP_DB_USER: string;
  BACKUP_DB_PASSWORD: string;
  BACKUP_RETENTION_DAYS: number;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export type BackofficeBackupSetup =
  | { configured: false; missing: string[] }
  | {
      configured: true;
      runnerUrl: string;
      runnerToken: string;
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      retentionDays: number;
      serviceRoleKey: string;
    };

type RequiredBackupSetting =
  | "BACKUP_RUNNER_URL"
  | "BACKUP_RUNNER_TOKEN"
  | "BACKUP_DB_HOST"
  | "BACKUP_DB_NAME"
  | "BACKUP_DB_USER"
  | "BACKUP_DB_PASSWORD";

export function getBackofficeBackupSetup(env: BackofficeBackupEnvironment): BackofficeBackupSetup {
  const required: Array<[RequiredBackupSetting, string]> = [
    ["BACKUP_RUNNER_URL", "BACKUP_RUNNER_URL"],
    ["BACKUP_RUNNER_TOKEN", "BACKUP_RUNNER_TOKEN"],
    ["BACKUP_DB_HOST", "BACKUP_DB_HOST"],
    ["BACKUP_DB_NAME", "BACKUP_DB_NAME"],
    ["BACKUP_DB_USER", "BACKUP_DB_USER"],
    ["BACKUP_DB_PASSWORD", "BACKUP_DB_PASSWORD"],
  ];
  const missing = required.filter(([key]) => !env[key].trim()).map(([, label]) => label);
  if (missing.length > 0) return { configured: false, missing };

  return {
    configured: true,
    runnerUrl: env.BACKUP_RUNNER_URL,
    runnerToken: env.BACKUP_RUNNER_TOKEN,
    host: env.BACKUP_DB_HOST,
    port: env.BACKUP_DB_PORT,
    database: env.BACKUP_DB_NAME,
    user: env.BACKUP_DB_USER,
    password: env.BACKUP_DB_PASSWORD,
    retentionDays: env.BACKUP_RETENTION_DAYS,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function buildBackofficeBackupPayload(
  setup: Extract<BackofficeBackupSetup, { configured: true }>,
) {
  return {
    clientSlug: BACKOFFICE_BACKUP_SLUG,
    host: setup.host,
    port: setup.port,
    database: setup.database,
    user: setup.user,
    password: setup.password,
    schedule: "daily",
    retention: { keepDaily: setup.retentionDays },
    supabase: {
      url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: setup.serviceRoleKey,
      includeStorage: true,
    },
  };
}

export function isBackofficeBackupConfigured(): boolean {
  return getBackofficeBackupSetup(serverEnv()).configured;
}

/** Runs a full database and Storage backup on the trusted backup server. */
export async function runBackofficeBackup(): Promise<{ mocked: boolean }> {
  if (isDemoMode()) return { mocked: true };

  const setup = getBackofficeBackupSetup(serverEnv());
  if (!setup.configured) {
    throw new Error(`Falta configurar: ${setup.missing.join(", ")}`);
  }

  let response: Response;
  try {
    response = await fetch(setup.runnerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${setup.runnerToken}`,
      },
      body: JSON.stringify(buildBackofficeBackupPayload(setup)),
      cache: "no-store",
    });
  } catch (error) {
    log.error({ err: error }, "backoffice_backup_runner_unreachable");
    throw new Error("No se pudo contactar con el servidor de backups.");
  }

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `El backup ha fallado (HTTP ${response.status}).`);
  }

  log.info({ retentionDays: setup.retentionDays }, "backoffice_backup_completed");
  return { mocked: false };
}
