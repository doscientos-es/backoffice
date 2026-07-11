"use client";

import {
  Combobox,
  ComboboxCollection,
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
}: EntityComboboxProps) {
  return (
    <Combobox
      value={value}
      onValueChange={(v) => onChange(v ?? "")}
      displayValue={(v: string) => {
        const item = items.find((i) => i.id === v);
        if (!item) return "";
        return item.sublabel ? `${item.label} · ${item.sublabel}` : item.label;
      }}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        showClear={!!value}
        className={className ?? "w-full"}
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxCollection>
            <ComboboxEmpty>Sin resultados</ComboboxEmpty>
            {items.map((item) => (
              <ComboboxItem
                key={item.id}
                value={item.id}
                label={item.sublabel ? `${item.label} ${item.sublabel}` : item.label}
              >
                <span className="flex-1">{item.label}</span>
                {item.sublabel && (
                  <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                )}
              </ComboboxItem>
            ))}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
