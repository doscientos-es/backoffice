"use client";

import { DatabaseBackup, Download, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { userVerificationScope } from "@/lib/security/user-verification-scope";
import { verifyWithPasskey } from "@/lib/security/webauthn-client";
import { triggerBackofficeBackup } from "./actions";

type ExportTable = { value: string; label: string };

export function BackupActions({
  runnerConfigured,
  tables,
}: {
  runnerConfigured: boolean;
  tables: readonly ExportTable[];
}) {
  const [pending, startTransition] = useTransition();
  const [table, setTable] = useState(tables[0]?.value ?? "");
  const csvHref = `/api/data-export?format=csv&table=${encodeURIComponent(table)}`;

  function forceBackup() {
    startTransition(async () => {
      const verification = await verifyWithPasskey(
        userVerificationScope("backoffice.backup.run", "backoffice:production"),
      );
      if (!verification.ok) {
        sileo.error({ title: verification.error });
        return;
      }
      const result = await triggerBackofficeBackup();
      if (result.ok) sileo.success({ title: "Copia de seguridad iniciada" });
      else sileo.error({ title: result.error });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={forceBackup} disabled={!runnerConfigured || pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
          {pending ? "Creando copia…" : "Crear copia ahora"}
        </Button>
        {!runnerConfigured ? (
          <span className="text-xs text-muted-foreground">La copia automática se activará al configurar el runner.</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button asChild variant="outline">
          <a href="/api/data-export?format=json" download>
            <Download className="size-4" />
            Descargar todos los datos (JSON)
          </a>
        </Button>
        <Select
          value={table}
          onChange={(event) => setTable(event.target.value)}
          aria-label="Tabla para exportar como CSV"
          className="w-52"
        >
          {tables.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Button asChild variant="outline" disabled={!table}>
          <a href={csvHref} download>
            <Download className="size-4" />
            Descargar CSV
          </a>
        </Button>
      </div>
    </div>
  );
}