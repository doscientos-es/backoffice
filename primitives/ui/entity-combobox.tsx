'use client'

import { useMemo, type ReactNode } from 'react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from './combobox'

export interface EntityOption {
  id: string
  label: string
  sublabel?: string | null
  leading?: ReactNode
}

interface EntityComboboxProps {
  id?: string
  items: EntityOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  name?: string
  disabled?: boolean
  required?: boolean
  'aria-label'?: string
  /**
   * Optional custom renderer for each item in the dropdown list.
   * Receives the full EntityOption; must return the inner content of the item
   * (the ComboboxItem wrapper is added automatically).
   */
  renderItem?: (item: EntityOption) => ReactNode
}

/** Searchable entity selection using the combobox's standard keyboard behavior. */
export function EntityCombobox({
  id,
  items,
  value,
  onChange,
  placeholder = '— Selecciona —',
  className,
  name,
  disabled = false,
  required = false,
  'aria-label': ariaLabel,
  renderItem,
}: EntityComboboxProps) {
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  return (
    <Combobox
      items={items.map((item) => item.id)}
      value={value}
      onValueChange={(id) => onChange(id ?? '')}
      disabled={disabled}
      // Include the sublabel so the library's built-in filter matches both
      // the name *and* the company/sublabel while typing.
      itemToStringLabel={(v: string) => {
        const item = itemsById.get(v)
        if (!item) return v ?? ''
        return item.sublabel ? `${item.label} · ${item.sublabel}` : item.label
      }}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        showClear={!!value}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        className={className ?? 'w-full'}
      />
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
      <ComboboxContent>
        <ComboboxEmpty>No se encontraron coincidencias</ComboboxEmpty>
        <ComboboxList>
          {(id: string) => {
            const item = itemsById.get(id)
            if (!item) return null
            return (
              <ComboboxItem key={item.id} value={item.id}>
                {renderItem ? (
                  renderItem(item)
                ) : (
                  <>
                    {item.leading ? <span className="shrink-0">{item.leading}</span> : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="max-w-[45%] truncate text-xs text-muted-foreground">
                        {item.sublabel}
                      </span>
                    )}
                  </>
                )}
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
