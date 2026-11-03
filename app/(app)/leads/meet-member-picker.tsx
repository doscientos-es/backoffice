'use client'

import { useCallback, useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

/** Shape passed for Meet invitee selection — subset of team_members with email. */
export type MeetMember = { id: string; name: string; email: string }

/** Optional teammates to invite to a calendar event. */
export function MemberCheckboxes({
  idPrefix,
  members,
  selected,
  onToggle,
}: {
  idPrefix: string
  members: MeetMember[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (members.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium">
        Añadir compañeros al calendario <span className="text-muted-foreground/60">(opcional)</span>
      </Label>
      <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-muted/30 p-2.5">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-member-${m.id}`}
              isSelected={selected.has(m.id)}
              onChange={() => onToggle(m.id)}
            />
            <label
              htmlFor={`${idPrefix}-member-${m.id}`}
              className="flex-1 cursor-pointer py-0.5 text-sm select-none"
            >
              {m.name}
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Selection state for `MemberCheckboxes`, plus helpers to read the chosen emails. */
export function useMemberToggle() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function emails(members: MeetMember[]) {
    return members.filter((m) => selected.has(m.id)).map((m) => m.email)
  }
  const reset = useCallback(() => setSelected(new Set()), [])
  return { selected, toggle, emails, reset }
}
