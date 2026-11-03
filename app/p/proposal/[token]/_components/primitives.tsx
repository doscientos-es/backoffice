import type { ReactNode } from 'react'

export const PROPOSAL_ACTION_CLASS =
  'rounded-full bg-[#BDFF7B] text-zinc-950 shadow-none hover:bg-[#a9ef65] focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-white'

/** Section heading; spacing replaces decorative rules between sections. */
export function SectionLabel({
  children,
  as: Tag = 'h2',
  className = '',
}: {
  children: ReactNode
  as?: 'h2' | 'h3' | 'p'
  className?: string
}) {
  return (
    <Tag
      className={`text-lg font-semibold tracking-tight text-zinc-950 dark:text-white ${className}`}
    >
      {children}
    </Tag>
  )
}

const STATUS_PILL: Record<string, string> = {
  accepted:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300',
  rejected:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300',
  expired:
    'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
}
const STATUS_PILL_PENDING = 'border-transparent bg-white/80 text-zinc-950'

export function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_PILL[status] ?? STATUS_PILL_PENDING}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
