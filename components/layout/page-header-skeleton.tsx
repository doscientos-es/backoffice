import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PageHeaderSkeletonProps = {
  /** Widths for breadcrumb pills, in px. Set to 0 to hide breadcrumbs. */
  breadcrumbs?: number[];
  /** Title width in px. */
  titleWidth?: number;
  /** Show description placeholder under the title. */
  withDescription?: boolean;
  /** Widths for action buttons on the right, in px. Empty array hides them. */
  actions?: number[];
  className?: string;
};

/**
 * Mirrors PageHeader layout: optional breadcrumb row, then title + actions.
 * Use as the first child of a detail/list loading.tsx so the page header
 * doesn't jump when real content takes over.
 */
export function PageHeaderSkeleton({
  breadcrumbs = [70, 110],
  titleWidth = 220,
  withDescription = false,
  actions = [96],
  className,
}: PageHeaderSkeletonProps) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {breadcrumbs.length > 0 ? (
        <div className="flex items-center gap-2">
          {breadcrumbs.map((w, i) => (
            <div key={`${w}-${i}`} className="flex items-center gap-2">
              <Skeleton className="h-3 rounded" style={{ width: w }} />
              {i < breadcrumbs.length - 1 ? (
                <span className="text-muted-foreground/40">/</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-7 rounded" style={{ width: titleWidth }} />
          {withDescription ? (
            <Skeleton className="mt-2 h-4 w-48 rounded" />
          ) : null}
        </div>
        {actions.length > 0 ? (
          <div className="flex shrink-0 items-center gap-2">
            {actions.map((w, i) => (
              <Skeleton
                key={`${w}-${i}`}
                className="h-8 rounded-md"
                style={{ width: w }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
