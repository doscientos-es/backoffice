import { getMyDay } from '@/lib/dashboard/queries'

import { MyDayPanel } from '../my-day-panel'
import type { MyDayScope } from './my-day-types'

export async function MyDayWidget({ userId, scope }: { userId: string; scope: MyDayScope }) {
  const assigneeId = scope.value === 'team' ? null : scope.value || userId
  const data = await getMyDay({ assigneeId })

  return <MyDayPanel {...data} scope={scope} />
}
