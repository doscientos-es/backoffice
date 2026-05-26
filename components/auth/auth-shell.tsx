import { Logo } from "@/components/branding";
import Link from "next/link";
import type { ReactNode } from "react";

export type AuthShellProps = {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthShell({ title, description, footer, children }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,color-mix(in_oklch,var(--accent)_18%,transparent),transparent_70%)]"
        aria-hidden
      />
      <div className="w-full max-w-sm">
        <Link href="/" aria-label="doscientos" className="mb-8 flex items-center justify-center">
          <Logo size="lg" />
        </Link>
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {children}
        {footer ? (
          <p className="mt-6 text-center text-xs text-muted">{footer}</p>
        ) : null}
      </div>
    </main>
  );
}
