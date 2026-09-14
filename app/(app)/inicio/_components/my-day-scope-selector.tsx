'use client'

import { LoaderCircle } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { Select } from '@/components/ui/select'

import type { MyDayScope } from './my-day-types'

export function MyDayScopeSelector({ scope }: { scope: MyDayScope }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [selectedValue, setSelectedValue] = useState(scope.value)

  useEffect(() => {
    setSelectedValue(scope.value)
  }, [scope.value])

  function updateScope(value: string) {
    if (value === scope.value) return

    setSelectedValue(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('member', value)
    else params.delete('member')
    const query = params.toString()
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="my-day-scope" className="text-muted-foreground text-xs font-medium">
        Ver
      </label>
      <Select
        id="my-day-scope"
        value={selectedValue}
        onChange={(event) => updateScope(event.target.value)}
        aria-label="Mostrar acciones de"
        aria-busy={pending}
        disabled={pending}
        className="h-9 w-auto max-w-full min-w-40 text-sm"
      >
        <option value="">Mis tareas</option>
        <option value="team">Equipo completo</option>
        {scope.members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Select>
      <span
        className="text-muted-foreground inline-flex min-w-24 items-center gap-1 text-xs"
        aria-live="polite"
      >
        {pending ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Actualizando…
          </>
        ) : null}
      </span>
    </div>
  )
}
