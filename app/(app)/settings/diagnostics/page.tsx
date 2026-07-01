import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getSystemStatus } from "@/lib/diagnostics/system-status";
import { DiagnosticsPanel } from "./diagnostics-panel";

export const metadata = { title: "Diagnóstico · Ajustes · doscientos" };
export const dynamic = "force-dynamic";

export default async function DiagnosticsSettingsPage() {
  await requireRole(["owner", "admin"]);
  const status = getSystemStatus();

  const byKey = (key: string) => status.integrations.find((i) => i.key === key)?.configured ?? false;
  const config = {
    telegramBot: byKey("telegram_bot"),
    telegramChat: byKey("telegram_chat"),
    ai: byKey("ai"),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Diagnóstico"
        description="Estado de las integraciones y pruebas con datos de ejemplo."
      />

      <Card>
        <CardHeader>
          <CardTitle>Estado de las integraciones</CardTitle>
          <CardDescription>Configuración detectada en el entorno (sin secretos).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <ul className="grid gap-2 sm:grid-cols-2">
            {status.integrations.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  {item.detail ? (
                    <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                  ) : null}
                </div>
                <Badge variant={item.configured ? "success" : "neutral"} className="shrink-0">
                  {item.configured ? "Configurado" : "No configurado"}
                </Badge>
              </li>
            ))}
          </ul>

          <dl className="grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
            {status.runtime.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="truncate font-mono text-xs">{item.value || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <DiagnosticsPanel config={config} />
    </div>
  );
}
