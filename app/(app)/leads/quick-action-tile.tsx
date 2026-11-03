'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Compact primary action tile with an icon and a concise label. */
export function QuickActionTile({
  icon,
  label,
  tone = 'default',
  ...props
}: {
  icon: ReactNode
  label: string
  tone?: 'default' | 'whatsapp'
} & React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-8 w-full min-w-0 justify-start gap-2 border-border/80 bg-card/60 px-2.5 text-left font-medium [&>span]:min-w-0',
        'transition-colors hover:border-foreground/25 hover:bg-muted/60',
        tone === 'whatsapp' &&
          'border-emerald-500/25 hover:border-emerald-500/50 hover:bg-emerald-500/10',
      )}
      {...props}
    >
      {icon}
      <span className="truncate text-xs">{label}</span>
    </Button>
  )
}
