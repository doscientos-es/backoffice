'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { Markdown } from '@/components/ui/markdown'

import { acceptProposal, rejectProposal } from './actions'

type FiscalForm = {
  name: string
  nif: string
  billing_address: string
  contact_person: string
  email: string
  phone: string
}

type SignatureForm = {
  signer_name: string
  signer_role: string
  accepts_terms: boolean
}

type Props = {
  token: string
  /** When true, the visitor must provide fiscal data before accepting. */
  needsFiscal: boolean
  /** Best-effort prefill of the fiscal form from lead/client info. */
  fiscalPrefill: FiscalForm
  /** Best-effort prefill from the contact to make the signature step faster. */
  signerPrefill: string
  /** Complete contractual annex that the signer can review before consenting. */
  legalTerms: string
}

export function ProposalActions({ token, needsFiscal, fiscalPrefill, signerPrefill, legalTerms }: Props) {
  const feedback = useFormFeedback({ successResetMs: 0 })
  const [showReject, setShowReject] = useState(false)
  const [showAccept, setShowAccept] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [reason, setReason] = useState('')
  const [fiscal, setFiscal] = useState<FiscalForm>(fiscalPrefill)
  const [signature, setSignature] = useState<SignatureForm>({
    signer_name: signerPrefill,
    signer_role: '',
    accepts_terms: false,
  })

  const onAccept = async () => {
    if (!signature.signer_name.trim()) {
      feedback.setError('Indica tu nombre completo para firmar')
      return
    }
    if (!signature.accepts_terms) {
      feedback.setError('Debes aceptar las condiciones para firmar la propuesta')
      return
    }
    if (needsFiscal && (!fiscal.name.trim() || !fiscal.nif.trim() || !fiscal.billing_address.trim())) {
      feedback.setError('Completa razón social, NIF y dirección de facturación')
      return
    }
    const fiscalData = needsFiscal
      ? {
        name: fiscal.name.trim(),
        nif: fiscal.nif.trim(),
        billing_address: fiscal.billing_address.trim(),
        contact_person: fiscal.contact_person.trim() || undefined,
        email: fiscal.email.trim() || undefined,
        phone: fiscal.phone.trim() || undefined,
      }
      : undefined
    feedback.setPending()
    const res = await acceptProposal(
      token,
      {
        signer_name: signature.signer_name.trim(),
        signer_role: signature.signer_role.trim() || undefined,
        accepts_terms: true,
      },
      fiscalData,
    )
    if (res.ok) feedback.setSuccess('Propuesta firmada y aceptada. Gracias.')
    else feedback.setError(res.error)
  }

  const onReject = async () => {
    feedback.setPending()
    const res = await rejectProposal(token, reason.trim() || undefined)
    if (res.ok) feedback.setSuccess('Respuesta registrada.')
    else feedback.setError(res.error)
  }

  const patch = (k: keyof FiscalForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFiscal((prev) => ({ ...prev, [k]: e.target.value }))

  if (showAccept) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Firma y aceptación</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">
              Al firmar, confirmas que puedes obligar al Cliente y aceptas esta propuesta con sus
              condiciones. La firma electrónica quedará registrada junto al documento aceptado.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="signer-name">Nombre completo *</Label>
                <Input
                  id="signer-name"
                  autoComplete="name"
                  value={signature.signer_name}
                  onChange={(event) =>
                    setSignature((previous) => ({ ...previous, signer_name: event.target.value }))
                  }
                  disabled={feedback.pending}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="signer-role">Cargo (opcional)</Label>
                <Input
                  id="signer-role"
                  autoComplete="organization-title"
                  placeholder="Ej. Administrador/a, CEO o apoderado/a"
                  value={signature.signer_role}
                  onChange={(event) =>
                    setSignature((previous) => ({ ...previous, signer_role: event.target.value }))
                  }
                  disabled={feedback.pending}
                />
              </div>
            </div>
            {needsFiscal ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Necesitamos los datos fiscales para emitir la factura al aceptar la propuesta.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="fiscal-name">Razón social *</Label>
                    <Input
                      id="fiscal-name"
                      value={fiscal.name}
                      onChange={patch('name')}
                      disabled={feedback.pending}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fiscal-nif">NIF / CIF *</Label>
                    <Input
                      id="fiscal-nif"
                      value={fiscal.nif}
                      onChange={patch('nif')}
                      disabled={feedback.pending}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fiscal-contact">Persona de contacto</Label>
                    <Input
                      id="fiscal-contact"
                      value={fiscal.contact_person}
                      onChange={patch('contact_person')}
                      disabled={feedback.pending}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="fiscal-address">Dirección de facturación *</Label>
                    <Input
                      id="fiscal-address"
                      value={fiscal.billing_address}
                      onChange={patch('billing_address')}
                      disabled={feedback.pending}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fiscal-email">Email</Label>
                    <Input
                      id="fiscal-email"
                      type="email"
                      value={fiscal.email}
                      onChange={patch('email')}
                      disabled={feedback.pending}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fiscal-phone">Teléfono</Label>
                    <Input
                      id="fiscal-phone"
                      value={fiscal.phone}
                      onChange={patch('phone')}
                      disabled={feedback.pending}
                    />
                  </div>
                </div>
              </>
            ) : null}
            <label className="border-border flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={signature.accepts_terms}
                onChange={(event) =>
                  setSignature((previous) => ({ ...previous, accepts_terms: event.target.checked }))
                }
                disabled={feedback.pending}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                Declaro que tengo capacidad suficiente para representar al Cliente y acepto íntegramente
                la propuesta, sus condiciones particulares y el anexo contractual.
              </span>
            </label>
            <button
              type="button"
              className="text-primary w-fit text-sm font-medium underline underline-offset-4"
              onClick={() => setShowTerms(true)}
            >
              Leer el anexo contractual completo
            </button>
            <div className="flex flex-col gap-2">
              <FormFeedback state={feedback.state} pendingLabel="Procesando…" />
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowAccept(false)}
                disabled={feedback.pending}
              >
                Cancelar
              </Button>
              <Button className="w-full" onClick={onAccept} disabled={feedback.pending}>
                {feedback.pending ? 'Procesando…' : 'Firmar y aceptar propuesta'}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Dialog open={showTerms} onOpenChange={setShowTerms}>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Anexo contractual</DialogTitle>
              <DialogDescription>
                Estas son las condiciones completas que aceptarás al firmar la propuesta.
              </DialogDescription>
            </DialogHeader>
            <Markdown source={legalTerms} className="text-sm leading-relaxed" />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (showReject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rechazar propuesta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cuéntanos qué podemos mejorar"
              rows={4}
              maxLength={500}
              disabled={feedback.pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowReject(false)}
              disabled={feedback.pending}
            >
              Cancelar
            </Button>
            <Button
              className="w-full"
              variant="destructive"
              onClick={onReject}
              disabled={feedback.pending}
            >
              {feedback.pending ? 'Enviando…' : 'Confirmar rechazo'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tu respuesta</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Puedes rechazarla o firmarla electrónicamente. La firma es definitiva y genera un registro
          verificable del documento aceptado.
        </p>
        <div className="flex flex-col gap-2">
          <FormFeedback state={feedback.state} pendingLabel="Procesando…" />
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setShowReject(true)}
            disabled={feedback.pending}
          >
            Rechazar
          </Button>
          <Button
            className="w-full"
            onClick={() => setShowAccept(true)}
            disabled={feedback.pending}
          >
            {feedback.pending ? 'Procesando…' : 'Firmar y aceptar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
