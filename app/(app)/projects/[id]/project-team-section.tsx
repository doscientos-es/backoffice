'use client'

import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROLE_OPTIONS } from '@/lib/permissions'

import { updateProjectTeam } from './project-team-actions'

type Member = { id: string; name: string; role: string }

export function ProjectTeamSection({
  projectId,
  members,
  assignedMemberIds,
}: {
  projectId: string
  members: Member[]
  assignedMemberIds: string[]
}) {
  const [query, setQuery] = useState('')
  const eligibleMembers = members.filter(
    (member) =>
      member.role !== 'owner' &&
      member.role !== 'admin' &&
      member.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  const [selected, setSelected] = useState(
    () =>
      new Set(
        assignedMemberIds.filter((id) =>
          members.some(
            (member) => member.id === id && member.role !== 'owner' && member.role !== 'admin',
          ),
        ),
      ),
  )
  const [saved, setSaved] = useState(
    () =>
      new Set(
        assignedMemberIds.filter((id) =>
          members.some(
            (member) => member.id === id && member.role !== 'owner' && member.role !== 'admin',
          ),
        ),
      ),
  )
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Añade colaboradores para darles acceso a este proyecto y sus tareas.
        </p>
        <Button
          size="sm"
          onClick={save}
          disabled={
            pending || (selected.size === saved.size && [...selected].every((id) => saved.has(id)))
          }
        >
          {pending ? 'Guardando…' : 'Guardar equipo'}
        </Button>
      </div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar miembro del equipo…"
        aria-label="Buscar miembro del equipo"
      />
      {eligibleMembers.map((member) => (
        <label
          key={member.id}
          className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.has(member.id)}
            onChange={() => toggle(member.id)}
            className="size-4 accent-primary"
          />
          <span className="min-w-0 flex-1 truncate">{member.name}</span>
          <span className="text-xs text-muted-foreground">
            {ROLE_OPTIONS.find((role) => role.value === member.role)?.label ?? member.role}
          </span>
        </label>
      ))}
      {eligibleMembers.length === 0 && !query.trim() ? (
        <p className="text-sm text-muted-foreground">
          No hay colaboradores para añadir. Propietarios y administradores ya tienen acceso global.
        </p>
      ) : eligibleMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay miembros con ese nombre.</p>
      ) : null}
    </div>
  )
}
