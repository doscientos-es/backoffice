'use client'

import { CircleCheck as CheckCircle2, LoaderCircle as Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'

import { completeReminder } from '../../reminders/actions'

type Props = {
  reminder: {
    id: string
    title: string
    whenLabel: string | null
    overdue: boolean
  }
}

/** Completes a lead reminder (task with kind='reminder') in place from the next-actions list. */
export function LeadNextActionReminderItem({ reminder }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [completed, setCompleted] = useState(false)

  function complete() {
    startTransition(async () => {
      const result = await completeReminder({ id: reminder.id })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }
      setCompleted(true)
      router.refresh()
    })
  }

  if (completed) return null

  return (
    <li className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm">
      <Link href={`/tasks/${reminder.id}`} className="min-w-0 truncate font-medium hover:underline">
        <span className="text-muted-foreground mr-2 text-xs">Aviso</span>
        {reminder.title}
      </Link>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {reminder.whenLabel ? (
          <span
            className={
              reminder.overdue ? 'text-destructive font-medium' : 'text-muted-foreground'
            }
          >
            {reminder.whenLabel}
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Marcar aviso como hecho: ${reminder.title}`}
          title="Marcar como hecho"
          disabled={pending}
          onClick={complete}
          className="text-muted-foreground hover:text-green-600 dark:hover:text-green-500"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
        </Button>
      </div>
    </li>
  )
}
