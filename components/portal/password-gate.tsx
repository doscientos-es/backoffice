'use client'

import { Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'

type UnlockAction = (input: unknown) => Promise<{ ok: true } | { ok: false; error: string }>

/**
 * Public password prompt rendered in place of a protected proposal/invoice
 * portal document. On success the server action drops the unlock cookie and we
 * `router.refresh()` so the page re-renders with the document visible.
 *
 * Resource-agnostic: the caller injects the matching unlock server action.
 */
export function PortalPasswordGate({ token, action, language = 'es' }: { token: string; action: UnlockAction; language?: 'es' | 'ca' | 'en' }) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [password, setPassword] = useState('')
  const copy = language === 'ca'
    ? { empty: 'Introdueix la contrasenya', granted: 'Accés concedit', title: 'Document protegit', intro: 'Introdueix la contrasenya per accedir a aquest document.', password: 'Contrasenya', checking: 'Comprovant…', access: 'Accedir' }
    : language === 'en'
      ? { empty: 'Enter the password', granted: 'Access granted', title: 'Protected document', intro: 'Enter the password to access this document.', password: 'Password', checking: 'Checking…', access: 'Access' }
      : { empty: 'Introduce la contraseña', granted: 'Acceso concedido', title: 'Documento protegido', intro: 'Introduce la contraseña para acceder a este documento.', password: 'Contraseña', checking: 'Comprobando…', access: 'Acceder' }

  async function handleSubmit() {
    if (!password.trim()) {
      feedback.setError(copy.empty)
      return
    }
    feedback.setPending()
    const res = await action({ token, password })
    if (res.ok) {
      feedback.setSuccess(copy.granted)
      router.refresh()
    } else {
      feedback.setError(res.error)
    }
  }

  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="flex flex-col items-center gap-5 px-8 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <Lock className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {copy.title}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {copy.intro}
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
          className="flex w-full max-w-xs flex-col gap-3"
        >
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={copy.password}
            autoComplete="current-password"
            disabled={feedback.pending}
          />
          <Button type="submit" disabled={feedback.pending} className="w-full">
            {feedback.pending ? copy.checking : copy.access}
          </Button>
          <div className="flex justify-center">
            <FormFeedback state={feedback.state} pendingLabel={copy.checking} />
          </div>
        </form>
      </div>
    </article>
  )
}
