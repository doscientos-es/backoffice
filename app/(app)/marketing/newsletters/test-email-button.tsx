'use client'

import { useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'

import { sendEmailMarketingTest, sendSavedEmailMarketingTest } from './actions'

export function TestEmailButton({ stepId }: { stepId?: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size={stepId ? 'sm' : 'default'}
      title={stepId ? 'Enviar el contenido guardado a tu email' : undefined}
      disabled={pending}
      onClick={(event) => {
        const form = event.currentTarget.closest('form')
        if (!form && !stepId) return
        const data = form && !stepId ? new FormData(form) : null
        startTransition(async () => {
          const result = stepId
            ? await sendSavedEmailMarketingTest({ id: stepId })
            : await sendEmailMarketingTest(data!)
          if (!result.ok) return void sileo.error({ title: result.error })
          sileo.success({ title: `Prueba enviada a ${result.email}` })
        })
      }}
    >
      {pending ? 'Enviando prueba…' : stepId ? 'Enviar prueba' : 'Enviar prueba ahora'}
    </Button>
  )
}
