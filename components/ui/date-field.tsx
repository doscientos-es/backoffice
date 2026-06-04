"use client";

import { InputGroup, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { format, isValid, parse } from "date-fns";
import { CalendarDays } from "lucide-react";
import type * as React from "react";
import { useId, useRef, useState } from "react";

const DISPLAY_FMT = "dd/MM/yyyy";
const ISO_FMT = "yyyy-MM-dd";

/** ISO `yyyy-MM-dd` → display `dd/MM/yyyy` ("" when empty/invalid). */
function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const d = parse(iso, ISO_FMT, new Date());
  return isValid(d) ? format(d, DISPLAY_FMT) : "";
}

/** Display `dd/MM/yyyy` → ISO `yyyy-MM-dd` ("" when incomplete/invalid). */
function displayToIso(text: string): string {
  if (text.length < 10) return "";
  const d = parse(text, DISPLAY_FMT, new Date());
  return isValid(d) ? format(d, ISO_FMT) : "";
}

/** Progressively inserts the `/` separators while typing (max `dd/MM/yyyy`). */
function maskDate(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

type Props = {
  /** Submitted value, ISO `yyyy-MM-dd`. Empty string clears the field. */
  name: string;
  id?: string;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Native picker bounds, ISO `yyyy-MM-dd`. */
  min?: string;
  max?: string;
  className?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
};

/**
 * Date input with a Spanish (`dd/mm/aaaa`) display that always submits the
 * canonical ISO `yyyy-MM-dd` through a hidden input, so server actions and Zod
 * schemas stay unchanged. The native OS picker is one click away (calendar
 * button), avoiding the browser-locale format of a bare `<input type="date">`.
 */
export function DateField({
  name,
  id,
  defaultValue,
  required = false,
  disabled = false,
  min,
  max,
  className,
  ...aria
}: Props) {
  const reactId = useId();
  const fieldId = id ?? `${name}-${reactId}`;
  const initialIso = defaultValue ?? "";
  const [iso, setIso] = useState(initialIso);
  const [text, setText] = useState(() => isoToDisplay(initialIso));
  const nativeRef = useRef<HTMLInputElement>(null);

  function handleText(value: string) {
    const masked = maskDate(value);
    setText(masked);
    setIso(displayToIso(masked));
  }

  function handleBlur() {
    // Reformat a valid date, otherwise drop a half-typed/invalid value.
    setText(iso ? isoToDisplay(iso) : "");
  }

  function openNativePicker() {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={iso} />
      <InputGroup className={className} data-disabled={disabled || undefined}>
        <input
          id={fieldId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          required={required}
          disabled={disabled}
          value={text}
          onChange={(e) => handleText(e.target.value)}
          onBlur={handleBlur}
          data-slot="input-group-control"
          className="flex-1 rounded-none border-0 bg-transparent px-2.5 py-1 text-base outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed md:text-sm"
          {...aria}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-xs"
            aria-label="Abrir calendario"
            disabled={disabled}
            onClick={openNativePicker}
          >
            <CalendarDays />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {/* Hidden native control: powers the OS calendar picker only. */}
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        min={min}
        max={max}
        value={iso}
        onChange={(e) => {
          setIso(e.target.value);
          setText(isoToDisplay(e.target.value));
        }}
        className={cn("pointer-events-none absolute right-2 bottom-0 size-0 opacity-0")}
      />
    </div>
  );
}
