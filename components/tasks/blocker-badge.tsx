import { CircleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

export function BlockerBadge({ reason }: { reason?: string | null }) {
  if (!reason) return null
  return (
    <Badge variant="warning" title={reason}>
      <CircleAlert className="size-3" aria-hidden /> Bloqueada
      <span className="sr-only">: {reason}</span>
    </Badge>
  )
}
