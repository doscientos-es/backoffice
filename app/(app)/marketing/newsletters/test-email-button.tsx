'use client'

import { useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'

import { sendEmailMarketingTest } from './actions'

export function TestEmailButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={(event) => {
        const form = event.currentTarget.closest('form')
        if (!form) return
        const data = new FormData(form)
        startTransition(async () => {
          const result = await sendEmailMarketingTest(data)
          if (!result.ok) return void sileo.error({ title: result.error })
          sileo.success({ title: `Prueba enviada a ${result.email}` })
        })
      }}
    >
      {pending ? 'Enviando prueba…' : 'Enviar prueba ahora'}
    </Button>
  )
}
