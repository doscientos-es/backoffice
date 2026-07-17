"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { ReactNode } from "react";

export interface EntityOption {
  id: string;
  label: string;
  sublabel?: string | null;
  leading?: ReactNode;
}

interface EntityComboboxProps {
  id?: string;
  items: EntityOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
}

/**
 * Generic searchable combobox for selecting a single entity (lead, client, etc.).
 * Wraps the @base-ui/react Combobox primitives with built-in filtering.
 */
export function EntityCombobox({
  id,
  items,
  value,
  onChange,
  placeholder = "— Selecciona —",
  className,
  name,
  disabled = false,
  required = false,
  "aria-label": ariaLabel,
}: EntityComboboxProps) {
  return (
    <Combobox
      items={items.map((item) => item.id)}
      value={value}
      onValueChange={(v) => onChange(v ?? "")}
      disabled={disabled}
      itemToStringLabel={(v: string) => {
        const item = items.find((i) => i.id === v);
        if (!item) return v ?? "";
        return item.sublabel ? `${item.label} · ${item.sublabel}` : item.label;
      }}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        showClear={!!value}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        className={className ?? "w-full"}
      />
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
      <ComboboxContent>
        <ComboboxEmpty>No se encontraron coincidencias</ComboboxEmpty>
        <ComboboxList>
          {(id: string) => {
            const item = items.find((option) => option.id === id);
            if (!item) return null;

            return (
              <ComboboxItem key={item.id} value={item.id}>
                {item.leading ? <span className="shrink-0">{item.leading}</span> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="max-w-[45%] truncate text-xs text-muted-foreground">
                    {item.sublabel}
                  </span>
                )}
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
