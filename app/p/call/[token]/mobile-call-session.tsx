'use client'

import { CheckCircle2, Phone, PhoneOff } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

type Completion = { durationMinutes: number; defaultOutcome: 'connected' | 'no_answer' }
type CallSessionStatus = 'started' | 'dialing' | 'awaiting_log' | 'logged' | 'abandoned'
type Action = 'dial' | 'finish'
type ActionResponse = { error?: string } & Partial<Completion>

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  const plusIndex = cleaned.indexOf('+')
  return plusIndex > 0 ? cleaned.slice(plusIndex) : cleaned
}

function actionErrorMessage(error?: string): string {
  switch (error) {
    case 'session_changed':
      return 'La llamada se actualizó desde otro dispositivo. Recarga la página para ver el estado actual.'
    case 'session_closed':
      return 'La llamada ya está cerrada. Recarga la página para ver el estado actual.'
    case 'not_found':
      return 'La sesión no existe o ha caducado.'
    case 'rate_limited':
      return 'Hay demasiados intentos. Espera un momento e inténtalo de nuevo.'
    default:
      return 'No se pudo actualizar la llamada.'
  }
}

export function MobileCallSession({ token, phone, status: initialStatus }: { token: string; phone: string; status: CallSessionStatus }) {
  const [status, setStatus] = useState(initialStatus)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completion, setCompletion] = useState<Completion | null>(null)

  async function update(action: Action): Promise<boolean> {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/public/call-sessions/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const result = (await response.json().catch(() => ({}))) as ActionResponse
      if (!response.ok) throw new Error(actionErrorMessage(result.error))
      if (action === 'dial') setStatus('dialing')
      if (action === 'finish' && result.durationMinutes !== undefined && result.defaultOutcome) {
        const next = { durationMinutes: result.durationMinutes, defaultOutcome: result.defaultOutcome }
        setCompletion(next)
        setStatus('awaiting_log')
      }
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : actionErrorMessage())
      return false
    } finally {
      setPending(false)
    }
  }

  async function startCall() {
    if (await update('dial')) window.location.assign(`tel:${normalizePhone(phone)}`)
  }

  async function finishCall() {
    await update('finish')
  }

  const canCall = status === 'started' || status === 'dialing'
  const closed = status === 'logged'
  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-5 py-10 sm:py-16">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Llamada preparada</p>
        <h1 className="text-2xl font-semibold tracking-tight">Llama desde este móvil</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Al terminar, confirma el cierre aquí. El resultado se registrará en tu ordenador.</p>
      </div>
      <div className="rounded-xl border border-emerald-900/10 bg-white/70 p-5 text-center dark:border-emerald-200/10 dark:bg-white/4">
        <p className="font-mono text-lg font-semibold tracking-wide">{phone}</p>
      </div>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {completion || status === 'logged' ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-50/70 p-4 text-sm text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4" /> Llamada finalizada</div>
          <p className="mt-2">{completion ? `Duración estimada: ${completion.durationMinutes} min. ` : ''}Completa el resultado y las notas en el ordenador.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button type="button" size="lg" onClick={startCall} disabled={pending || !canCall} className="gap-2"><Phone className="size-4" /> Abrir teléfono</Button>
          <Button type="button" size="lg" variant="outline" onClick={finishCall} disabled={pending || closed} className="gap-2"><PhoneOff className="size-4" /> {status === 'awaiting_log' ? 'Ver cierre' : 'He terminado'}</Button>
        </div>
      )}
    </section>
  )
}