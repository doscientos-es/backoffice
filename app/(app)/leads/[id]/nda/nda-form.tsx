'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { createNda } from './actions'

type Props = { leadId: string; defaults: { name: string; representative: string } }

export function NdaForm({ leadId, defaults }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const result = await createNda({
      leadId,
      counterpartyName: String(form.get('counterpartyName') ?? ''),
      counterpartyNif: String(form.get('counterpartyNif') ?? ''),
      counterpartyAddress: String(form.get('counterpartyAddress') ?? ''),
      representativeName: String(form.get('representativeName') ?? ''),
      purpose: String(form.get('purpose') ?? ''),
      confidentialityYears: Number(form.get('confidentialityYears') ?? 3),
      effectiveDate: String(form.get('effectiveDate') ?? ''),
    })
    if (result.ok) router.refresh()
    else setError(result.error)
    setPending(false)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Empresa o persona"
        name="counterpartyName"
        defaultValue={defaults.name}
        required
      />
      <Field label="NIF / CIF" name="counterpartyNif" />
      <Field
        label="Representante"
        name="representativeName"
        defaultValue={defaults.representative}
      />
      <Field label="Domicilio" name="counterpartyAddress" />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="purpose">Finalidad del acuerdo</Label>
        <Textarea
          id="purpose"
          name="purpose"
          required
          defaultValue="Evaluar una posible colaboración y, en su caso, el desarrollo de un proyecto de software."
        />
      </div>
      <Field
        label="Años de confidencialidad"
        name="confidentialityYears"
        type="number"
        defaultValue="3"
      />
      <Field label="Fecha de efecto" name="effectiveDate" type="date" defaultValue={today} />
      {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creando…' : 'Crear NDA'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  )
}
