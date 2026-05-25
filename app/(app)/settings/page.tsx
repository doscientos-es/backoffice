import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Ajustes · doscientos" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Tu información y firma de email.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Row label="Nombre" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Rol" value={user.role} />
          <Row label="Alias email" value={user.emailAlias ?? "—"} />
          <Row label="Envío de email" value={user.emailSendEnabled ? "Activado" : "Desactivado"} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-2 py-1.5">
      <span className="text-[color:var(--text-muted)]">{label}</span>
      <span className="text-[color:var(--text-primary)]">{value}</span>
    </div>
  );
}
