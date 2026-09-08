import { Slot } from 'radix-ui'
import type * as React from 'react'

import { cn } from '../lib/utils'

function TabList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="tablist"
      data-slot="tab-list"
      className={cn('flex items-center gap-1 overflow-x-auto border-b border-border', className)}
      {...props}
    />
  )
}

function TabTrigger({
  className,
  active = false,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & { active?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      role="tab"
      aria-selected={active}
      data-slot="tab-trigger"
      data-active={active || undefined}
      type={asChild ? undefined : 'button'}
      className={cn(
        '-mb-px inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
        active && 'border-primary text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function TabCount({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="tab-count"
      className={cn(
        'rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none tabular-nums text-muted-foreground group-data-[active]/tab:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { TabCount, TabList, TabTrigger }
