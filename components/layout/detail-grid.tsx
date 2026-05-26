import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function DetailGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[140px_1fr] gap-x-4 gap-y-2.5 text-sm", className)}>
      {children}
    </dl>
  );
}

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-[color:var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 text-[color:var(--text-primary)]">{children ?? "—"}</dd>
    </>
  );
}
