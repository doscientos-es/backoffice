import { PageHeader } from "@/components/layout/page-header";
import { MfaTotpCard } from "@/components/security/mfa-totp-card";
import { PasskeyStatusCard } from "@/components/security/passkey-status-card";
import { requireUser } from "@/lib/auth";
import { hasRegisteredPasskey } from "@/lib/security/webauthn";

export const metadata = { title: "Seguridad · Ajustes · doscientos" };
export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const user = await requireUser();
  const passkeyConfigured = await hasRegisteredPasskey(user.id);
  const required = user.role === "owner" || user.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Seguridad"
        description="Gestiona los factores que protegen tu cuenta y las acciones sensibles."
      />
      <MfaTotpCard required={required} />
      <PasskeyStatusCard configured={passkeyConfigured} />
    </div>
  );
}
