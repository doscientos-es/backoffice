"use server";

import { revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth";
import { BACKOFFICE_BACKUP_SLUG, runBackofficeBackup } from "@/lib/backups/backoffice";
import { backupsCacheTag } from "@/lib/filebrowser";
import { consumeUserVerification } from "@/lib/security/user-verification";
import { userVerificationScope } from "@/lib/security/user-verification-scope";

export async function triggerBackofficeBackup(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireRole(["owner", "admin"]);
    await consumeUserVerification(
      user.id,
      userVerificationScope("backoffice.backup.run", "backoffice:production"),
    );
    await runBackofficeBackup();
    revalidateTag(backupsCacheTag(BACKOFFICE_BACKUP_SLUG), "default");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo crear el backup" };
  }
}