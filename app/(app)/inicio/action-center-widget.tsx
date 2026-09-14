import { canViewFinance, requireUser } from '@/lib/auth'
import { getActionCenter } from '@/lib/dashboard/queries'

import { ActionCenter } from './action-center'

export async function ActionCenterWidget() {
  const user = await requireUser()
  const data = await getActionCenter({ memberId: user.id, showFinance: canViewFinance(user.role) })
  return <ActionCenter {...data} />
}