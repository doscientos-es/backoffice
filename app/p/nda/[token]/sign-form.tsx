'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { signNda } from './actions'

export function SignNdaForm({ token }: { token: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [accept, setAccept] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await signNda({ token, name, accept })
    if (result.ok) router.refresh()
    else setError(result.error)
    setPending(false)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nda-name">Tu nombre completo</Label>
        <Input
          id="nda-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={accept}
          onChange={(event) => setAccept(event.target.checked)}
          className="mt-1"
        />
        He leído el acuerdo y acepto sus términos en nombre de la Otra Parte.
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !accept || name.trim().length < 3}>
        {pending ? 'Firmando…' : 'Firmar acuerdo'}
      </Button>
    </form>
  )
}
