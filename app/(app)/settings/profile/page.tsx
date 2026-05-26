import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "../profile-form";

export const metadata = { title: "Perfil · Ajustes · doscientos" };

export default async function ProfileSettingsPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Perfil"
        description="Alias de remitente, firma HTML y tu cuenta de GitHub."
      />
      <Card>
        <CardContent className="pt-6">
          <ProfileForm
            name={user.name}
            email={user.email}
            emailAlias={user.emailAlias ?? null}
            emailSendEnabled={user.emailSendEnabled}
            signatureHtml={user.signatureHtml ?? null}
            githubHandle={user.githubHandle ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
