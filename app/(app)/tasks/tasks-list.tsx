'use client'

import { CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { ListPage, type ListPageProps } from '@/components/layout/list-page'

import { bulkCompleteTasks } from './actions'

type TasksListProps = Omit<ListPageProps, 'bulkActions'>

export function TasksList(props: TasksListProps) {
  const router = useRouter()

  return (
    <ListPage
      {...props}
      bulkActions={[
        {
          label: 'Completar',
          icon: CheckCircle2,
          onAction: async (ids) => {
            const result = await bulkCompleteTasks({ ids })
            if (!result.ok) throw new Error(result.error)
            router.refresh()
          },
        },
      ]}
    />
  )
}