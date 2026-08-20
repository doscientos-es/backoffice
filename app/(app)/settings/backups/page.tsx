import { BackupsCard } from "@/app/(app)/webs/_components/backups-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/auth";
import { BACKOFFICE_BACKUP_SLUG, getBackofficeBackupSetup } from "@/lib/backups/backoffice";
import { serverEnv } from "@/lib/env";
import { EXPORTABLE_TABLES } from "@/lib/exports/data";
import { isFileBrowserConfigured } from "@/lib/filebrowser";
import { BackupActions } from "./backup-actions";

export const metadata = { title: "Copias de seguridad · Ajustes · doscientos" };
export const dynamic = "force-dynamic";

function labelForTable(table: string) {
  return table.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function BackupSettingsPage() {
  await requirePageRole(["owner", "admin"]);
  const env = serverEnv();
  const setup = getBackofficeBackupSetup(env);
  const archiveConfigured = isFileBrowserConfigured();
  const tables = EXPORTABLE_TABLES.map((value) => ({ value, label: labelForTable(value) }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Copias de seguridad"
        description="Copias diarias fuera de Supabase y exportaciones para guardar localmente."
      />

      <Card>
        <CardHeader>
          <CardTitle>Descargar los datos actuales</CardTitle>
          <CardDescription>
            Descarga un JSON completo o el CSV de una tabla para abrirlo en Excel. Es una
            exportación puntual del estado actual, no una copia restaurable del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <BackupActions
            runnerConfigured={setup.configured}
            tables={tables}
            showBackupAction={false}
          />
          <p className="text-sm text-muted-foreground">
            Los archivos físicos de Supabase Storage no van en esta descarga; sus metadatos y rutas
            sí.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Respaldo automático</CardTitle>
              <CardDescription>
                Cada día se guarda un dump de PostgreSQL y una réplica de los archivos de Storage en
                el servidor de backups.
              </CardDescription>
            </div>
            <Badge variant={setup.configured ? "success" : "neutral"}>
              {setup.configured ? "Activo" : "Pendiente de configurar"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Se conservan las últimas {env.BACKUP_RETENTION_DAYS} copias diarias. Las credenciales
            nunca se muestran ni se incluyen en las exportaciones.
          </p>
          <BackupActions
            runnerConfigured={setup.configured}
            tables={tables}
            showExportActions={false}
          />
        </CardContent>
      </Card>

      {archiveConfigured ? (
        <BackupsCard clientSlug={BACKOFFICE_BACKUP_SLUG} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Historial de copias</CardTitle>
            <CardDescription>
              Configura FileBrowser para consultar y descargar las copias del servidor.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
