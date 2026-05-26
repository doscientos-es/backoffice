import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description?: string;
  back?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, back, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {back ? <div className="text-sm">{back}</div> : null}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
