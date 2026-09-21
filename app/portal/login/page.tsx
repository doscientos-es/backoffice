'use client'

import { FormEvent, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function ClientPortalLoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname.startsWith('/portal/') ? window.location.pathname : '/portal')}` },
    })
    setBusy(false)
    if (authError) setError('No hemos podido enviar el acceso. Inténtalo de nuevo.')
    else setSent(true)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Área de cliente</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Accede a tu documentación</h1>
        {sent ? (
        <p className="mt-5 text-muted-foreground">Te hemos enviado un enlace de acceso a tu email. Puedes cerrar esta ventana.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium" htmlFor="portal-email">Email</label>
            <input id="portal-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border bg-background px-4 py-3" autoComplete="email" />
            <button disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60">{busy ? 'Enviando…' : 'Enviarme un enlace de acceso'}</button>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </form>
        )}
      </section>
    </main>
  )
}
