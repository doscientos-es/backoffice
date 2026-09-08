'use client'

import { Megaphone, Target } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { TabList, TabTrigger } from '@/components/ui/tabs'
import type { MarketingView } from '@/lib/marketing/range'
import { cn } from '@/lib/utils'

const TABS: { value: MarketingView; label: string; icon: typeof Target }[] = [
  { value: 'ads', label: 'Por anuncio', icon: Target },
  { value: 'campaigns', label: 'Por campaña', icon: Megaphone },
]

export function MarketingViewTabs({ current }: { current: MarketingView }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const onSelect = (next: MarketingView) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'ads') params.delete('view')
    else params.set('view', next)
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  return (
    <TabList
      aria-label="Vista"
      className={cn('h-9 rounded-lg border border-border bg-card p-0.5 text-sm', pending && 'opacity-70')}
    >
      {TABS.map((tab) => {
        const active = tab.value === current
        const Icon = tab.icon
        return (
          <TabTrigger
            key={tab.value}
            active={active}
            onClick={() => onSelect(tab.value)}
            className={cn(
              'rounded-md border-b-0 px-3 py-1.5',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </TabTrigger>
        )
      })}
    </TabList>
  )
}
