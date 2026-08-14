import { describe, expect, it } from "vitest";
import { buildBackofficeBackupPayload, getBackofficeBackupSetup } from "./backoffice";

const baseEnv = {
  BACKUP_RUNNER_URL: "https://backup.example.test/run",
  BACKUP_RUNNER_TOKEN: "runner-token",
  BACKUP_DB_HOST: "db.example.test",
  BACKUP_DB_PORT: 5432,
  BACKUP_DB_NAME: "postgres",
  BACKUP_DB_USER: "backup_user",
  BACKUP_DB_PASSWORD: "database-password",
  BACKUP_RETENTION_DAYS: 14,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

describe("backoffice backup setup", () => {
  it("reports every missing required setting", () => {
    const setup = getBackofficeBackupSetup({
      ...baseEnv,
      BACKUP_DB_HOST: "",
      BACKUP_DB_PASSWORD: "",
    });
    expect(setup).toEqual({ configured: false, missing: ["BACKUP_DB_HOST", "BACKUP_DB_PASSWORD"] });
  });

  it("builds a daily runner request including retention and Storage mirroring", () => {
    const setup = getBackofficeBackupSetup(baseEnv);
    if (!setup.configured) throw new Error("Expected configured backup setup");

    expect(buildBackofficeBackupPayload(setup)).toMatchObject({
      clientSlug: "doscientos-backoffice",
      schedule: "daily",
      retention: { keepDaily: 14 },
      supabase: { includeStorage: true },
    });
  });
});
