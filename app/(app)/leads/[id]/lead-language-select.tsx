'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sileo } from 'sileo'

import { Select } from '@/components/ui/select'

import { updateLead } from '../actions'

const OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'ca', label: 'Català' },
  { value: 'en', label: 'English' },
] as const

export function LeadLanguageSelect({
  leadId,
  leadName,
  version,
  language,
}: {
  leadId: string
  leadName: string
  version: number
  language: string | null
}) {
  const router = useRouter()
  const [value, setValue] = useState(language ?? 'es')
  const [saving, setSaving] = useState(false)
  const selected = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0]

  return (
    <label className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs">
      <span
        aria-hidden="true"
        className={selected.value === 'ca' ? 'size-4 rounded-[2px] border border-black/10' : undefined}
        style={selected.value === 'ca'
          ? { background: 'repeating-linear-gradient(to bottom, #f6d64a 0 2px, #b83232 2px 4px)' }
          : undefined}
      >
        {selected.value === 'es' ? '🇪🇸' : selected.value === 'en' ? '🇬🇧' : null}
      </span>
      <Select
        aria-label="Idioma de contacto del lead"
        className="h-7 w-auto border-0 bg-transparent p-0 pr-5 text-xs shadow-none focus-visible:ring-0"
        value={value}
        disabled={saving}
        onChange={async (event) => {
          const next = event.target.value as 'es' | 'ca' | 'en'
          const previous = value
          setValue(next)
          setSaving(true)
          const result = await updateLead({
            id: leadId,
            name: leadName,
            expected_version: version,
            language: next,
          })
          setSaving(false)
          if (!result.ok) {
            setValue(previous)
            sileo.error({ title: result.error ?? 'No se pudo actualizar el idioma' })
            return
          }
          sileo.success({ title: 'Idioma actualizado' })
          router.refresh()
        }}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <span className="sr-only">{saving ? 'Guardando idioma' : 'Idioma del lead'}</span>
    </label>
  )
}
