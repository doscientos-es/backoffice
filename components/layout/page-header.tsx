import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export type BreadcrumbEntry = {
  label: string;
  href?: string;
};

export type PageHeaderProps = {
  title: string;
  description?: string;
  back?: ReactNode;
  breadcrumbs?: BreadcrumbEntry[];
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  back,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  const hasCrumbs = breadcrumbs && breadcrumbs.length > 0;
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {hasCrumbs ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((entry, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <Fragment key={`${entry.label}:${i}`}>
                  <BreadcrumbItem>
                    {isLast || !entry.href ? (
                      <BreadcrumbPage className="truncate max-w-[28ch]">
                        {entry.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={entry.href} className="truncate max-w-[20ch]">
                          {entry.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {isLast ? null : <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : back ? (
        <div className="text-sm">{back}</div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:break-word]">
            {title}
          </h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
