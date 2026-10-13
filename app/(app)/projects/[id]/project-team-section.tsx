'use client'

import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { updateProjectTeam } from './project-team-actions'

type Member = { id: string; name: string }

export function ProjectTeamSection({
  projectId,
  members,
  assignedMemberIds,
  memberRoles,
}: {
  projectId: string
  members: Member[]
  assignedMemberIds: string[]
  memberRoles: Record<string, string>
}) {
  const eligibleMembers = members.filter((member) => memberRoles[member.id] === 'delivery')
  const [selected, setSelected] = useState(() => new Set(assignedMemberIds))
  const [saved, setSaved] = useState(() => new Set(assignedMemberIds))
  const [pending, startTransition] = useTransition()

  function toggle(memberId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  function save() {
    startTransition(async () => {
      const result = await updateProjectTeam({ projectId, memberIds: [...selected] })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }
      setSaved(new Set(selected))
      sileo.success({ title: 'Colaboradores del proyecto actualizados.' })
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Equipo del proyecto</CardTitle>
        <Button
          size="sm"
          onClick={save}
          disabled={
            pending || (selected.size === saved.size && [...selected].every((id) => saved.has(id)))
          }
        >
          {pending ? 'Guardando…' : 'Guardar equipo'}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Añade colaboradores para darles acceso a este proyecto y sus tareas.
        </p>
        {eligibleMembers.map((member) => (
          <label key={member.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(member.id)}
              onChange={() => toggle(member.id)}
              className="size-4 accent-primary"
            />
            {member.name}
          </label>
        ))}
        {eligibleMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay miembros de Entrega activos.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
