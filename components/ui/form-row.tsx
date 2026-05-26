import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormRowProps {
  label: React.ReactNode;
  htmlFor: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
}

/**
 * Vertical form row used across resource forms: label (+ required asterisk),
 * control, optional hint and optional error message.
 *
 * Standardises spacing, label sizing and `aria-describedby` wiring so every
 * form in the app feels consistent.
 */
export function FormRow({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  labelClassName,
  children,
}: FormRowProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className={cn("text-xs font-medium", labelClassName)}>
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (obligatorio)</span> : null}
      </Label>
      {children}
      {hint ? (
        <p id={hintId} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[11px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
