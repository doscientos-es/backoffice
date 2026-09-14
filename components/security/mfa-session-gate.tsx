'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { MemberRole } from '@/lib/auth'
import { hasCurrentMfaAccess } from '@/lib/security/mfa-actions'
import { getBrowserClient } from '@/lib/supabase/browser'

import { MfaChallengeDialog } from './mfa-challenge-dialog'

type Props = { memberRole: MemberRole; mfaVerified: boolean }

/** Challenges administrative sessions in-place before they use protected areas. */
export function MfaSessionGate({ memberRole, mfaVerified }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [verifiedPath, setVerifiedPath] = useState<string | null>(mfaVerified ? pathname : null)
  const requiresMfa =
    (memberRole === 'owner' || memberRole === 'admin') && pathname !== '/settings/security'
  const open = requiresMfa && verifiedPath !== pathname

  useEffect(() => {
    if (!requiresMfa) {
      setVerifiedPath(pathname)
      return
    }

    let active = true
    void (async () => {
      try {
        const { data, error } = await getBrowserClient().auth.mfa.getAuthenticatorAssuranceLevel()
        const verified = !error && data?.currentLevel === 'aal2'
        const hasAccess = verified || (await hasCurrentMfaAccess())
        if (active) setVerifiedPath(hasAccess ? pathname : null)
      } catch {
        if (active) setVerifiedPath(null)
      }
    })()

    return () => {
      active = false
    }
  }, [pathname, requiresMfa])

  return (
    <MfaChallengeDialog
      open={open}
      onOpenChange={() => undefined}
      onVerified={() => {
        setVerifiedPath(pathname)
        router.refresh()
      }}
      dismissible={false}
      setupHref="/settings/security"
    />
  )
}
