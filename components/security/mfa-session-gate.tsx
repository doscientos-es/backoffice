'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { MemberRole } from '@/lib/auth'
import { hasCurrentMfaAccess } from '@/lib/security/mfa-actions'
import { userVerificationScope } from '@/lib/security/user-verification-scope'
import { getBrowserClient } from '@/lib/supabase/browser'

const MfaChallengeDialog = dynamic(
  () => import('./mfa-challenge-dialog').then((m) => m.MfaChallengeDialog),
  { ssr: false },
)

type Props = { memberRole: MemberRole; mfaVerified: boolean }

/** Challenges administrative sessions in-place before they use protected areas. */
export function MfaSessionGate({ memberRole, mfaVerified }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  // Verification belongs to the session, not to a route. Keeping it across
  // navigations avoids flashing the dialog while the background re-check runs.
  const [verified, setVerified] = useState(mfaVerified)
  const requiresMfa =
    (memberRole === 'owner' || memberRole === 'admin') && pathname !== '/settings/security'
  const open = requiresMfa && !verified
  const [dialogMounted, setDialogMounted] = useState(open)

  useEffect(() => {
    if (open) setDialogMounted(true)
  }, [open])

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname intentionally re-triggers the background MFA re-check on navigation
  useEffect(() => {
    if (!requiresMfa) return

    let active = true
    void (async () => {
      try {
        const { data, error } = await getBrowserClient().auth.mfa.getAuthenticatorAssuranceLevel()
        const aal2 = !error && data?.currentLevel === 'aal2'
        const hasAccess = aal2 || (await hasCurrentMfaAccess())
        if (active) setVerified(hasAccess)
      } catch {
        if (active) setVerified(false)
      }
    })()

    return () => {
      active = false
    }
  }, [pathname, requiresMfa])

  if (!dialogMounted) return null

  return (
    <MfaChallengeDialog
      open={open}
      onOpenChange={() => undefined}
      onVerified={() => {
        setVerified(true)
        router.refresh()
      }}
      dismissible={false}
      setupHref="/settings/security"
      passkeyScope={userVerificationScope('admin.mfa', 'current-session')}
    />
  )
}
