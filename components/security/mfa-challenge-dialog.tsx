'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OtpInput,
} from '@doscientos/ui'
import { Fingerprint, LoaderCircle as Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  trustCurrentMfaDevice,
  trustCurrentMfaDeviceAfterPasskey,
} from '@/lib/security/mfa-actions'
import type { UserVerificationScope } from '@/lib/security/user-verification-scope'
import { getBrowserClient } from '@/lib/supabase/browser'

import { usePasskeyVerification } from './use-passkey-verification'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerified: () => void
  dismissible?: boolean
  setupHref?: string
  passkeyScope?: UserVerificationScope
}

export function MfaChallengeDialog({
  open,
  onOpenChange,
  onVerified,
  dismissible = true,
  setupHref,
  passkeyScope,
}: Props) {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { challenge: passkeyChallenge, verifyWithPasskey } = usePasskeyVerification()
  const hasPasskeyScope = Boolean(passkeyScope)

  useEffect(() => {
    if (!open) return
    setCode('')
    setError(null)
    setLoading(true)
    void getBrowserClient()
      .auth.mfa.listFactors()
      .then(({ data, error: factorsError }) => {
        const factor = data?.totp.find((candidate) => candidate.status === 'verified')
        setFactorId(factor?.id ?? null)
        if ((factorsError || !factor) && !hasPasskeyScope) {
          setError('No hay una aplicación Authenticator configurada para esta cuenta.')
        }
      })
      .finally(() => setLoading(false))
  }, [hasPasskeyScope, open])

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!factorId) return
    setError(null)
    setLoading(true)
    const { error: verifyError } = await getBrowserClient().auth.mfa.challengeAndVerify({
      factorId,
      code,
    })
    setLoading(false)
    if (verifyError) {
      setError('El código no es válido. Comprueba la hora de tu dispositivo e inténtalo de nuevo.')
      return
    }
    const trust = await trustCurrentMfaDevice()
    if (!trust.ok) {
      setError(trust.error)
      return
    }
    onVerified()
  }

  async function verifyWithBiometric() {
    if (!passkeyScope) return
    setError(null)
    setBiometricLoading(true)
    const verification = await verifyWithPasskey(passkeyScope)
    if (!verification.ok) {
      setBiometricLoading(false)
      setError(verification.error)
      return
    }
    const trust = await trustCurrentMfaDeviceAfterPasskey()
    setBiometricLoading(false)
    if (!trust.ok) {
      setError(trust.error)
      return
    }
    onVerified()
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => (dismissible || nextOpen) && onOpenChange(nextOpen)}
      >
        <DialogContent className="sm:max-w-sm" showCloseButton={dismissible}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="text-primary size-5" /> Confirmar acción
            </DialogTitle>
            <DialogDescription>
              {passkeyScope
                ? 'Usa la biometría de este dispositivo o introduce el código de Authenticator para continuar.'
                : 'Introduce el código de Authenticator para continuar.'}{' '}
              No saldrás de esta página.
            </DialogDescription>
          </DialogHeader>
          {passkeyScope ? (
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={verifyWithBiometric}
                disabled={loading || biometricLoading}
              >
                {biometricLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Fingerprint className="size-4" />
                )}
                Usar biometría
              </Button>
              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <span className="bg-border h-px flex-1" />
                <span>o usa Authenticator</span>
                <span className="bg-border h-px flex-1" />
              </div>
            </div>
          ) : null}
          <form onSubmit={verify} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="invoice-mfa-code">Código de verificación</FieldLabel>
              <OtpInput
                id="invoice-mfa-code"
                autoFocus
                value={code}
                onChange={setCode}
                disabled={loading || biometricLoading || !factorId}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'invoice-mfa-code-error' : undefined}
                required
              />
            </Field>
            {error ? (
              <p id="invoice-mfa-code-error" role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
            {error && setupHref ? (
              <a className="text-primary text-sm underline underline-offset-4" href={setupHref}>
                Configurar MFA en Seguridad
              </a>
            ) : null}
            <DialogFooter>
              {dismissible ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={loading || biometricLoading}
                >
                  Cancelar
                </Button>
              ) : null}
              <Button
                type="submit"
                disabled={loading || biometricLoading || !factorId || code.length < 6}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : null} Verificar y continuar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {passkeyScope ? passkeyChallenge : null}
    </>
  )
}
