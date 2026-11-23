import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth'
import { HandwrittenSignatureSchema } from '@/lib/proposals/handwritten-signature'
import { createServerClient } from '@/lib/supabase/server'

import { PersonalSignatureForm } from '../personal-signature-form'
import { ProfileForm } from '../profile-form'

export const metadata = { title: 'Perfil · Ajustes · doscientos' }

export default async function ProfileSettingsPage() {
  const user = await requireUser()
  const supabase = await createServerClient()
  const { data: signature, error: signatureError } = await supabase
    .from('team_member_signatures')
    .select('signature')
    .eq('member_id', user.id)
    .maybeSingle()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Perfil"
        description="Datos personales, alias de remitente y firma auto-generada."
      />
      <Card>
        <CardContent className="pt-6">
          <ProfileForm
            name={user.name}
            email={user.email}
            avatarUrl={user.avatarUrl}
            emailAlias={user.emailAlias ?? null}
            githubHandle={user.githubHandle ?? null}
            jobTitle={user.jobTitle ?? null}
            phone={user.phone ?? null}
            contactEmail={user.contactEmail ?? null}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {signatureError ? (
            <p>No se ha podido cargar tu firma. Vuelve a intentarlo más tarde.</p>
          ) : (
            <PersonalSignatureForm
              initial={HandwrittenSignatureSchema.safeParse(signature?.signature).data ?? null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
