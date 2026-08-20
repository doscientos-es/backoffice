"use client";

import { Database as DatabaseBackup, CircleNotch as Loader2 } from "@phosphor-icons/react";
import { useTransition } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { verifyWithPasskey } from "@/lib/security/webauthn-client";
import { triggerWebBackup } from "../actions";

type Props = {
  projectId: string;
  slug: string | null;
};

/**
 * Triggers an on-demand backup via the `triggerWebBackup` server action, which
 * forwards to the local bridge. Shows a loading state while the dump runs (the
 * action awaits the script) and a toast with the outcome.
 */
export function ForceBackupButton({ projectId, slug }: Props) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const verification = await verifyWithPasskey(
        userVerificationScope("web.backup.run", `web:${projectId}`),
      );
      if (!verification.ok) {
        sileo.error({ title: verification.error });
        return;
      }
      const res = await triggerWebBackup({ id: projectId, slug });
      if (res.ok) {
        sileo.success({ title: "Backup completado" });
      } else {
        sileo.error({ title: res.error ?? "No se pudo completar el backup" });
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={pending}>
      {pending ? (
        <Loader2 className="mr-1.5 size-4 animate-spin" />
      ) : (
        <DatabaseBackup className="mr-1.5 size-4" />
      )}
      Forzar backup
    </Button>
  );
}
