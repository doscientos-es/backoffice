import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral:
          "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)]",
        success:
          "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]",
        warning:
          "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 text-[color:var(--warning)]",
        danger:
          "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
        info: "border-[color:var(--info)]/30 bg-[color:var(--info)]/10 text-[color:var(--info)]",
        hot: "border-[color:var(--hot)]/30 bg-[color:var(--hot)]/10 text-[color:var(--hot)]",
        warm: "border-[color:var(--warm)]/30 bg-[color:var(--warm)]/10 text-[color:var(--warm)]",
        cold: "border-[color:var(--cold)]/30 bg-[color:var(--cold)]/10 text-[color:var(--cold)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
