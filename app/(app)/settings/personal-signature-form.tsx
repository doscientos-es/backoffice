'use client'

import { SignaturePad, type SignatureValue } from '@doscientos/ui/signature-pad'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { HandwrittenSignatureSchema } from '@/lib/proposals/handwritten-signature'

import { savePersonalSignature } from './signature-actions'

export function PersonalSignatureForm({ initial }: { initial: SignatureValue | null }) {
  const [signature, setSignature] = useState(initial)
  const [pending, startTransition] = useTransition()
  const feedback = useFormFeedback()

  function save() {
    if (signature && !HandwrittenSignatureSchema.safeParse(signature).success) {
      feedback.setError('La firma es demasiado compleja. Bórrala y vuelve a intentarlo.')
      return
    }
    feedback.setPending()
    startTransition(async () => {
      const result = await savePersonalSignature(signature)
      if (result.ok) feedback.setSuccess('Firma guardada')
      else feedback.setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <SignaturePad
        value={signature}
        onChange={setSignature}
        disabled={pending}
        label="Firma manuscrita personal"
        description="Dibuja y guarda tu firma para utilizarla en las propuestas correspondientes."
        clearLabel="Borrar firma"
        emptyLabel="Firma aquí"
        signedLabel="Firma dibujada"
      />
      <div className="flex items-center justify-end gap-3">
        <FormFeedback state={feedback.state} />
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar firma'}
        </Button>
      </div>
    </div>
  )
}
