"use client";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import type { EntityOption } from "@/components/ui/entity-combobox";
import { cn } from "@/lib/utils";

export interface EntityMultiComboboxProps {
  id?: string;
  items: EntityOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * Generic searchable multi-select combobox. Selected entities render as
 * removable chips. Wraps the @base-ui/react Combobox primitives in
 * `multiple` mode with built-in filtering.
 */
export function EntityMultiCombobox({
  id,
  items,
  value,
  onChange,
  placeholder = "Buscar…",
  className,
  disabled = false,
  "aria-label": ariaLabel,
}: EntityMultiComboboxProps) {
  const anchor = useComboboxAnchor();
  const labelFor = (v: string) => {
    const item = items.find((i) => i.id === v);
    if (!item) return v;
    return item.sublabel ? `${item.label} · ${item.sublabel}` : item.label;
  };

  return (
    <Combobox
      multiple
      value={value}
      onValueChange={(v: string[]) => onChange(v ?? [])}
      itemToStringLabel={labelFor}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className={cn("w-full", className)}>
        <ComboboxValue>
          {(selected: string[]) =>
            selected.map((v) => (
              <ComboboxChip key={v} aria-label={labelFor(v)}>
                {labelFor(v)}
              </ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxChipsInput
          id={id}
          placeholder={value.length ? "" : placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
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
