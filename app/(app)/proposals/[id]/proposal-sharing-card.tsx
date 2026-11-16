import type { ComponentProps } from 'react'

import { PortalAccessControls } from '@/components/portal/portal-access-controls'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { SendPreviewButton } from './send-preview-button'
import { ShareLinks } from './share-links'

type Props = {
  id: string
  title: string
  token: string | null
  portalViewedAt: string | null
  deckViewedAt: string | null
  isDraft: boolean
  locked: boolean
  visible: boolean
  hasPassword: boolean
  recipientEmail: string | null
  alreadySent: boolean
  accessAction: ComponentProps<typeof PortalAccessControls>['action']
}

export function ProposalSharingCard({
  id,
  title,
  token,
  portalViewedAt,
  deckViewedAt,
  isDraft,
  locked,
  visible,
  hasPassword,
  recipientEmail,
  alreadySent,
  accessAction,
}: Props) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Compartir con el cliente</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {token ? (
          <>
            <ShareLinks
              token={token}
              proposalTitle={title}
              portalViewedAt={portalViewedAt}
              deckViewedAt={deckViewedAt}
              isDraft={isDraft}
            />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Acceso: {visible ? 'visible' : 'oculto'} ·{' '}
                {hasPassword ? 'con contraseña' : 'sin contraseña'}
              </summary>
              <div className="mt-2">
                <PortalAccessControls
                  id={id}
                  initialVisible={visible}
                  hasPassword={hasPassword}
                  action={accessAction}
                />
              </div>
            </details>
          </>
        ) : null}
        {locked ? (
          <p className="text-xs text-muted-foreground">La propuesta ya ha sido respondida.</p>
        ) : (
          <SendPreviewButton id={id} defaultEmail={recipientEmail} alreadySent={alreadySent} />
        )}
      </CardContent>
    </Card>
  )
}
