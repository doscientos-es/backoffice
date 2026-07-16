"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export interface EntityOption {
  id: string;
  label: string;
  sublabel?: string | null;
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
        <ComboboxList>
          <ComboboxEmpty>Sin resultados</ComboboxEmpty>
          {items.map((item) => (
            <ComboboxItem key={item.id} value={item.id}>
              <span className="flex-1">{item.label}</span>
              {item.sublabel && (
                <span className="text-xs text-muted-foreground">{item.sublabel}</span>
              )}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
