'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { type FormEvent, type ReactNode, useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'

import { deleteEmailMarketingStep } from './actions'

export function ActionForm({
  action,
  success,
  className,
  children,
  resetOnSuccess,
}: {
  action: (form: FormData) => Promise<{
    ok: boolean
    error?: string
    warning?: string
    successMessage?: string
  }>
  success: string
  className?: string
  children: ReactNode
  resetOnSuccess?: boolean
}) {
  const [pending, startTransition] = useTransition()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    startTransition(async () => {
      const result = await action(data)
      if (!result.ok)
        return void sileo.error({ title: result.error ?? 'No se pudo completar la acción' })
      if (result.warning) sileo.warning({ title: result.warning, duration: null })
      else sileo.success({ title: result.successMessage ?? success })
      if (resetOnSuccess) form.reset()
    })
  }
  return (
    <form onSubmit={submit} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  )
}

export function DeleteStepDialog({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const confirm = () =>
    startTransition(async () => {
      const result = await deleteEmailMarketingStep({ id })
      if (!result.ok) return void sileo.error({ title: result.error })
      sileo.success({ title: 'Email eliminado' })
      setOpen(false)
    })
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Eliminar email
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar «{title}»?</DialogTitle>
            <DialogDescription>
              Se eliminará este email pendiente. Los emails que ya hayan entrado en envío no se
              pueden eliminar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirm}>
              {pending ? 'Eliminando…' : 'Eliminar email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
