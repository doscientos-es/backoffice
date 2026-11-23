'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@doscientos/ui'
import { SignaturePad, type SignatureValue } from '@doscientos/ui/signature-pad'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Markdown } from '@/components/ui/markdown'
import { Textarea } from '@/components/ui/textarea'
import { HandwrittenSignatureSchema } from '@/lib/proposals/handwritten-signature'

import { PROPOSAL_ACTION_CLASS } from './_components/primitives'
import { acceptProposal, rejectProposal, trackSignIntent } from './actions'

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
  client_capacity: 'business' | 'consumer' | ''
  consumer_early_start: boolean
}

type Props = {
  token: string
  documentRevision: number
  /** Null preserves the signer choice for proposals issued before capacity was configured. */
  clientCapacity: 'business' | 'consumer' | null
  /** When true, the visitor must provide fiscal data before accepting. */
  needsFiscal: boolean
  /** Best-effort prefill of the fiscal form from lead/client info. */
  fiscalPrefill: FiscalForm
  /** Best-effort prefill from the contact to make the signature step faster. */
  signerPrefill: string
  /** Complete contractual annex that the signer can review before consenting. */
  legalTerms: string
  language?: 'es' | 'ca' | 'en'
}

export function ProposalActions({
  token,
  documentRevision,
  clientCapacity,
  needsFiscal,
  fiscalPrefill,
  signerPrefill,
  legalTerms,
  language = 'es',
}: Props) {
  const copy =
    language === 'ca'
      ? {
          acceptError: 'Indica el teu nom complet per signar',
          termsError: 'Has d’acceptar les condicions per signar la proposta',
          fiscalError: 'Completa la raó social, el NIF i l’adreça de facturació',
          accepted: 'Proposta signada i acceptada. Gràcies.',
          answered: 'Resposta registrada.',
          signTitle: 'Signatura i acceptació',
          signIntro:
            'En signar, confirmes que pots obligar el Client i acceptes aquesta proposta i les seves condicions. La signatura electrònica quedarà registrada amb el document acceptat.',
          name: 'Nom complet *',
          role: 'Càrrec (opcional)',
          rolePlaceholder: 'Ex. Administrador/a, CEO o apoderat/da',
          drawingLabel: 'Signatura manuscrita (opcional)',
          drawingDescription:
            'Signa amb el dit, un llapis o el ratolí. També pots acceptar sense dibuixar.',
          drawingClear: 'Esborrar signatura',
          drawingEmpty: 'Signa aquí',
          drawingSigned: 'Signatura dibuixada',
          drawingError: 'La signatura és massa complexa. Esborra-la i torna-ho a provar.',
          fiscalIntro:
            'Necessitem les dades fiscals per emetre la factura quan acceptis la proposta.',
          business: 'Raó social *',
          nif: 'NIF *',
          contact: 'Persona de contacte',
          address: 'Adreça de facturació *',
          phone: 'Telèfon',
          declaration:
            'Declaro que tinc capacitat suficient per representar el Client i accepto íntegrament la proposta, les seves condicions particulars i l’annex contractual.',
          capacity: 'Contractes com a',
          capacityError: 'Indica si contractes com a empresa/professional o com a consumidor.',
          capacityBusiness: 'Empresa o professional',
          capacityConsumer: 'Particular (consumidor)',
          capacityNoticeBusiness:
            'Aquesta proposta és per a una empresa o professional. Si no és correcte, contacta amb nosaltres abans de signar.',
          capacityNoticeConsumer:
            'Aquesta proposta és per a un consumidor. Si no és correcte, contacta amb nosaltres abans de signar.',
          earlyStart:
            'Sol·licito expressament que els serveis comencin durant el termini de desistiment de 14 dies naturals. Si desisteixo, abonaré la part proporcional ja prestada i perdré el dret de desistiment quan el servei s’hagi executat completament.',
          standardStart:
            'Si no ho sol·licites, els treballs començaran un cop passats els 14 dies naturals de desistiment, durant els quals pots desistir sense indicar el motiu.',
          downloadPdf: 'Descarregar la proposta en PDF',
          downloadSigned: 'Descarregar la proposta signada',
          continueAfterSigning: 'Veure els següents passos',
          readTerms: 'Llegir l’annex contractual complet',
          processing: 'En procés…',
          cancel: 'Cancel·lar',
          signAccept: 'Signar i acceptar la proposta',
          annex: 'Annex contractual',
          annexIntro: 'Aquestes són les condicions completes que acceptaràs en signar la proposta.',
          reject: 'Rebutjar la proposta',
          reason: 'Motiu (opcional)',
          improve: 'Explica’ns què podem millorar',
          sending: 'Enviant…',
          confirmReject: 'Confirmar el rebuig',
          response: 'La teva resposta',
          responseIntro:
            'Pots rebutjar-la o signar-la electrònicament. La signatura és definitiva i genera un registre verificable del document acceptat.',
          sign: 'Signar i acceptar',
        }
      : language === 'en'
        ? {
            acceptError: 'Enter your full name to sign',
            termsError: 'You must accept the terms to sign the proposal',
            fiscalError: 'Complete the company name, tax ID, and billing address',
            accepted: 'Proposal signed and accepted. Thank you.',
            answered: 'Response recorded.',
            signTitle: 'Signature and acceptance',
            signIntro:
              'By signing, you confirm that you can legally bind the Client and accept this proposal and its terms. The electronic signature will be recorded with the accepted document.',
            name: 'Full name *',
            role: 'Role (optional)',
            rolePlaceholder: 'E.g. Director, CEO, or attorney-in-fact',
            drawingLabel: 'Handwritten signature (optional)',
            drawingDescription:
              'Sign with your finger, a stylus, or a mouse. You can also accept without drawing.',
            drawingClear: 'Clear signature',
            drawingEmpty: 'Sign here',
            drawingSigned: 'Signature drawn',
            drawingError: 'The signature is too complex. Clear it and try again.',
            fiscalIntro:
              'We need your tax details to issue the invoice when you accept the proposal.',
            business: 'Company name *',
            nif: 'Tax ID *',
            contact: 'Contact person',
            address: 'Billing address *',
            phone: 'Phone',
            declaration:
              'I confirm that I have authority to represent the Client and fully accept this proposal, its specific terms, and the contractual annex.',
            capacity: 'You are contracting as',
            capacityError:
              'Select whether you are contracting as a business/professional or consumer.',
            capacityBusiness: 'Business or professional',
            capacityConsumer: 'Individual (consumer)',
            capacityNoticeBusiness:
              'This proposal is for a business or professional. If this is incorrect, contact us before signing.',
            capacityNoticeConsumer:
              'This proposal is for a consumer. If this is incorrect, contact us before signing.',
            earlyStart:
              'I expressly request that the services begin during the 14-calendar-day withdrawal period. If I withdraw, I will pay for the proportion already provided, and I will lose the right of withdrawal once the service has been fully performed.',
            standardStart:
              'If you do not request it, work will begin once the 14-calendar-day withdrawal period has ended, during which you may withdraw without giving a reason.',
            downloadPdf: 'Download the proposal as PDF',
            downloadSigned: 'Download the signed proposal',
            continueAfterSigning: 'See next steps',
            readTerms: 'Read the full contractual annex',
            processing: 'Processing…',
            cancel: 'Cancel',
            signAccept: 'Sign and accept proposal',
            annex: 'Contractual annex',
            annexIntro: 'These are the complete terms you will accept by signing the proposal.',
            reject: 'Decline proposal',
            reason: 'Reason (optional)',
            improve: 'Tell us what we could improve',
            sending: 'Sending…',
            confirmReject: 'Confirm decline',
            response: 'Your response',
            responseIntro:
              'You can decline or sign electronically. The signature is final and creates a verifiable record of the accepted document.',
            sign: 'Sign and accept',
          }
        : {
            acceptError: 'Indica tu nombre completo para firmar',
            termsError: 'Debes aceptar las condiciones para firmar la propuesta',
            fiscalError: 'Completa razón social, NIF y dirección de facturación',
            accepted: 'Propuesta firmada y aceptada. Gracias.',
            answered: 'Respuesta registrada.',
            signTitle: 'Firma y aceptación',
            signIntro:
              'Al firmar, confirmas que puedes obligar al Cliente y aceptas esta propuesta con sus condiciones. La firma electrónica quedará registrada junto al documento aceptado.',
            name: 'Nombre completo *',
            role: 'Cargo (opcional)',
            rolePlaceholder: 'Ej. Administrador/a, CEO o apoderado/a',
            drawingLabel: 'Firma manuscrita (opcional)',
            drawingDescription:
              'Firma con el dedo, un lápiz o el ratón. También puedes aceptar sin dibujar.',
            drawingClear: 'Borrar firma',
            drawingEmpty: 'Firma aquí',
            drawingSigned: 'Firma dibujada',
            drawingError: 'La firma es demasiado compleja. Bórrala y vuelve a intentarlo.',
            fiscalIntro:
              'Necesitamos los datos fiscales para emitir la factura al aceptar la propuesta.',
            business: 'Razón social *',
            nif: 'NIF / CIF *',
            contact: 'Persona de contacto',
            address: 'Dirección de facturación *',
            phone: 'Teléfono',
            declaration:
              'Declaro que tengo capacidad suficiente para representar al Cliente y acepto íntegramente la propuesta, sus condiciones particulares y el anexo contractual.',
            capacity: 'Contratas como',
            capacityError: 'Indica si contratas como empresa/profesional o como consumidor.',
            capacityBusiness: 'Empresa o profesional',
            capacityConsumer: 'Particular (consumidor)',
            capacityNoticeBusiness:
              'Esta propuesta es para una empresa o profesional. Si no es correcto, contacta con nosotros antes de firmar.',
            capacityNoticeConsumer:
              'Esta propuesta es para un consumidor. Si no es correcto, contacta con nosotros antes de firmar.',
            earlyStart:
              'Solicito expresamente que los servicios comiencen durante el plazo de desistimiento de 14 días naturales. Si desisto, abonaré la parte proporcional ya prestada y perderé el derecho de desistimiento cuando el servicio se haya ejecutado completamente.',
            standardStart:
              'Si no lo solicitas, los trabajos comenzarán una vez transcurridos los 14 días naturales de desistimiento, durante los cuales puedes desistir sin indicar el motivo.',
            downloadPdf: 'Descargar la propuesta en PDF',
            downloadSigned: 'Descargar la propuesta firmada',
            continueAfterSigning: 'Ver los siguientes pasos',
            readTerms: 'Leer el anexo contractual completo',
            processing: 'Procesando…',
            cancel: 'Cancelar',
            signAccept: 'Firmar y aceptar propuesta',
            annex: 'Anexo contractual',
            annexIntro: 'Estas son las condiciones completas que aceptarás al firmar la propuesta.',
            reject: 'Rechazar propuesta',
            reason: 'Motivo (opcional)',
            improve: 'Cuéntanos qué podemos mejorar',
            sending: 'Enviando…',
            confirmReject: 'Confirmar rechazo',
            response: 'Tu respuesta',
            responseIntro:
              'Puedes rechazarla o firmarla electrónicamente. La firma es definitiva y genera un registro verificable del documento aceptado.',
            sign: 'Firmar y aceptar',
          }
  const feedback = useFormFeedback({ successResetMs: 0 })
  const [showReject, setShowReject] = useState(false)
  const [showAccept, setShowAccept] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [reason, setReason] = useState('')
  const [fiscal, setFiscal] = useState<FiscalForm>(fiscalPrefill)
  const [drawing, setDrawing] = useState<SignatureValue | null>(null)
  const [signature, setSignature] = useState<SignatureForm>({
    signer_name: signerPrefill,
    signer_role: '',
    accepts_terms: false,
    client_capacity: clientCapacity ?? '',
    consumer_early_start: false,
  })

  const onAccept = async () => {
    if (!signature.signer_name.trim()) {
      feedback.setError(copy.acceptError)
      return
    }
    if (!signature.client_capacity) {
      feedback.setError(copy.capacityError)
      return
    }
    if (!signature.accepts_terms) {
      feedback.setError(copy.termsError)
      return
    }
    if (drawing && !HandwrittenSignatureSchema.safeParse(drawing).success) {
      feedback.setError(copy.drawingError)
      return
    }
    if (
      needsFiscal &&
      (!fiscal.name.trim() || !fiscal.nif.trim() || !fiscal.billing_address.trim())
    ) {
      feedback.setError(copy.fiscalError)
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
        client_capacity: signature.client_capacity,
        consumer_early_start:
          signature.client_capacity === 'consumer' && signature.consumer_early_start,
        ...(drawing ? { handwritten_signature: drawing } : {}),
      },
      fiscalData,
      documentRevision,
    )
    if (res.ok) setAccepted(true)
    else feedback.setError(res.error)
  }

  const onReject = async () => {
    feedback.setPending()
    const res = await rejectProposal(token, reason.trim() || undefined)
    if (res.ok) feedback.setSuccess(copy.answered)
    else feedback.setError(res.error)
  }

  const openAccept = () => {
    setShowAccept(true)
    // Lets the team know the lead is about to sign (deduplicated server-side).
    void trackSignIntent(token).catch(() => undefined)
  }

  const patch = (k: keyof FiscalForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFiscal((prev) => ({ ...prev, [k]: e.target.value }))

  if (accepted) {
    return (
      <Card className="border-0 bg-transparent shadow-none ring-0">
        <CardContent className="flex flex-col gap-4 py-6 text-center">
          <p className="font-semibold" role="status">
            {copy.accepted}
          </p>
          <a
            href={`/p/proposal/${token}/pdf?lang=${language}`}
            className={`inline-flex justify-center px-5 py-3 ${PROPOSAL_ACTION_CLASS}`}
          >
            {copy.downloadSigned}
          </a>
          <a
            href={`/p/proposal/${token}?lang=${language}`}
            className="text-sm underline underline-offset-4"
          >
            {copy.continueAfterSigning}
          </a>
        </CardContent>
      </Card>
    )
  }

  if (showAccept) {
    return (
      <>
        <Card className="border-0 bg-transparent shadow-none ring-0">
          <CardHeader>
            <CardTitle>{copy.signTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{copy.signIntro}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="signer-name">{copy.name}</Label>
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
                <Label htmlFor="signer-role">{copy.role}</Label>
                <Input
                  id="signer-role"
                  autoComplete="organization-title"
                  placeholder={copy.rolePlaceholder}
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
                <p className="text-sm text-muted-foreground">{copy.fiscalIntro}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="fiscal-name">{copy.business}</Label>
                    <Input
                      id="fiscal-name"
                      value={fiscal.name}
                      onChange={patch('name')}
                      disabled={feedback.pending}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fiscal-nif">{copy.nif}</Label>
                    <Input
                      id="fiscal-nif"
                      value={fiscal.nif}
                      onChange={patch('nif')}
                      disabled={feedback.pending}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fiscal-contact">{copy.contact}</Label>
                    <Input
                      id="fiscal-contact"
                      value={fiscal.contact_person}
                      onChange={patch('contact_person')}
                      disabled={feedback.pending}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="fiscal-address">{copy.address}</Label>
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
                    <Label htmlFor="fiscal-phone">{copy.phone}</Label>
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
            <SignaturePad
              value={drawing}
              onChange={setDrawing}
              disabled={feedback.pending}
              label={copy.drawingLabel}
              description={copy.drawingDescription}
              clearLabel={copy.drawingClear}
              emptyLabel={copy.drawingEmpty}
              signedLabel={copy.drawingSigned}
            />
            {clientCapacity ? (
              <p className="text-xs text-muted-foreground">
                {clientCapacity === 'business'
                  ? copy.capacityNoticeBusiness
                  : copy.capacityNoticeConsumer}
              </p>
            ) : (
              <fieldset className="flex flex-col gap-2" disabled={feedback.pending}>
                <legend className="mb-1 text-sm font-medium">{copy.capacity}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['business', copy.capacityBusiness],
                      ['consumer', copy.capacityConsumer],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm"
                    >
                      <input
                        type="radio"
                        name="client-capacity"
                        value={value}
                        checked={signature.client_capacity === value}
                        onChange={() =>
                          setSignature((previous) => ({ ...previous, client_capacity: value }))
                        }
                        className="size-4 shrink-0"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {signature.client_capacity === 'consumer' ? (
              <>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={signature.consumer_early_start}
                    onChange={(event) =>
                      setSignature((previous) => ({
                        ...previous,
                        consumer_early_start: event.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{copy.earlyStart}</span>
                </label>
                {!signature.consumer_early_start ? (
                  <p className="text-xs text-muted-foreground">{copy.standardStart}</p>
                ) : null}
              </>
            ) : null}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={signature.accepts_terms}
                onChange={(event) =>
                  setSignature((previous) => ({ ...previous, accepts_terms: event.target.checked }))
                }
                disabled={feedback.pending}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>{copy.declaration}</span>
            </label>
            <button
              type="button"
              className="w-fit text-xs text-muted-foreground underline underline-offset-4"
              onClick={() => setShowTerms(true)}
            >
              {copy.readTerms}
            </button>
            <div className="flex flex-col gap-2">
              <FormFeedback state={feedback.state} pendingLabel={copy.processing} />
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowAccept(false)}
                disabled={feedback.pending}
              >
                {copy.cancel}
              </Button>
              <Button
                className={`w-full ${PROPOSAL_ACTION_CLASS}`}
                onClick={() => void onAccept()}
                disabled={feedback.pending}
              >
                {feedback.pending ? copy.processing : copy.signAccept}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Dialog open={showTerms} onOpenChange={setShowTerms}>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{copy.annex}</DialogTitle>
              <DialogDescription>{copy.annexIntro}</DialogDescription>
            </DialogHeader>
            <Markdown source={legalTerms} className="text-sm leading-relaxed" />
            <a
              href={`/p/proposal/${token}/pdf?lang=${language}`}
              className="w-fit text-sm text-muted-foreground underline underline-offset-4"
            >
              {copy.downloadPdf}
            </a>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (showReject) {
    return (
      <Card className="border-0 bg-transparent shadow-none ring-0">
        <CardHeader>
          <CardTitle>{copy.reject}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">{copy.reason}</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={copy.improve}
              rows={4}
              maxLength={500}
              disabled={feedback.pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FormFeedback state={feedback.state} pendingLabel={copy.sending} />
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowReject(false)}
              disabled={feedback.pending}
            >
              {copy.cancel}
            </Button>
            <Button
              className="w-full"
              variant="destructive"
              onClick={() => void onReject()}
              disabled={feedback.pending}
            >
              {feedback.pending ? copy.sending : copy.confirmReject}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 bg-transparent shadow-none ring-0">
      <CardHeader className="text-center">
        <CardTitle>{copy.response}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">{copy.responseIntro}</p>
        <div className="flex flex-col gap-2">
          <FormFeedback state={feedback.state} pendingLabel={copy.processing} />
          <Button
            className={`w-full ${PROPOSAL_ACTION_CLASS}`}
            onClick={openAccept}
            disabled={feedback.pending}
          >
            {feedback.pending ? copy.processing : copy.sign}
          </Button>
          <Button
            className="w-full rounded-full"
            variant="ghost"
            onClick={() => setShowReject(true)}
            disabled={feedback.pending}
          >
            {copy.reject}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
