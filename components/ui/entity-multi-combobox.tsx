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

interface EntityMultiComboboxProps {
  id?: string;
  items: EntityOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
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
}: EntityMultiComboboxProps) {
  const anchor = useComboboxAnchor();
  const labelFor = (v: string) => items.find((i) => i.id === v)?.label ?? v;

  return (
    <Combobox multiple value={value} onValueChange={(v: string[]) => onChange(v ?? [])}>
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxValue>
          {(selected: string[]) =>
            selected.map((v) => (
              <ComboboxChip key={v} aria-label={labelFor(v)}>
                {labelFor(v)}
              </ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxChipsInput id={id} placeholder={value.length ? "" : placeholder} />
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
