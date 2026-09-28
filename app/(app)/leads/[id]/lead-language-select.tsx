'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
} from '@doscientos/ui/select'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sileo } from 'sileo'

import { updateLead } from '../actions'

const OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'ca', label: 'Català' },
  { value: 'en', label: 'English' },
] as const

function LanguageIcon({ language }: { language: (typeof OPTIONS)[number]['value'] }) {
  if (language === 'ca') {
    return (
      <span
        aria-hidden="true"
        className="h-3.5 w-4 shrink-0 rounded-[2px] border border-black/10"
        style={{
          background: 'repeating-linear-gradient(to bottom, #f6d64a 0 2px, #b83232 2px 4px)',
        }}
      />
    )
  }

  return <span aria-hidden="true">{language === 'es' ? '🇪🇸' : '🇬🇧'}</span>
}

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

  return (
    <div className="inline-flex">
      <Select
        aria-label="Idioma de contacto del lead"
        className="w-[138px]"
        selectedKey={value}
        isDisabled={saving}
        onSelectionChange={async (key) => {
          if (key == null) return
          const next = String(key) as (typeof OPTIONS)[number]['value']
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
        <SelectTrigger className="h-8 min-w-0 rounded-md px-2.5 py-1.5 text-sm shadow-none">
          <SelectValue>{({ defaultChildren }) => defaultChildren}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectList>
            {OPTIONS.map((option) => (
              <SelectItem key={option.value} id={option.value} textValue={option.label}>
                <span className="flex items-center gap-2">
                  <LanguageIcon language={option.value} />
                  <span>{option.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectList>
        </SelectContent>
      </Select>
      <span className="sr-only">{saving ? 'Guardando idioma' : 'Idioma del lead'}</span>
    </div>
  )
}
