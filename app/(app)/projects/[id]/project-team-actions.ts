'use server'

import { z } from 'zod'

import { defineAction } from '@/lib/actions/define-action'
import { createServerClient } from '@/lib/supabase/server'

const UpdateProjectTeamInput = z.object({
  projectId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()).max(100),
})

export const updateProjectTeam = defineAction({
  name: 'projects.updateTeam',
  schema: UpdateProjectTeamInput,
  revalidate: (_payload, input) => [`/projects/${input.projectId}`, '/projects'],
  handler: async ({ projectId, memberIds }, { user }) => {
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new Error('Solo administración puede cambiar el equipo del proyecto.')
    }
    const supabase = await createServerClient()
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .is('deleted_at', null)
      .maybeSingle()
    if (projectError || !project) throw new Error('No se encontró el proyecto.')
    const { data: eligibleMembers, error: memberError } = await supabase
      .from('team_members')
      .select('id')
      .in('id', memberIds)
      .eq('role', 'delivery')
      .is('deleted_at', null)
    if (memberError) throw new Error(memberError.message)
    if ((eligibleMembers ?? []).length !== new Set(memberIds).size) {
      throw new Error('Solo se pueden asignar miembros activos del equipo de Entrega.')
    }
    const { data: currentRows, error: selectError } = await supabase
      .from('project_team_members')
      .select('member_id')
      .eq('project_id', projectId)
    if (selectError) throw new Error(selectError.message)
    const currentIds = new Set((currentRows ?? []).map((row) => row.member_id as string))
    const nextIds = new Set(memberIds)
    const removedIds = [...currentIds].filter((id) => !nextIds.has(id))
    const addedIds = [...nextIds].filter((id) => !currentIds.has(id))

    if (removedIds.length > 0) {
      const { error } = await supabase
        .from('project_team_members')
        .delete()
        .eq('project_id', projectId)
        .in('member_id', removedIds)
      if (error) throw new Error(error.message)
    }
    if (addedIds.length > 0) {
      const { error } = await supabase
        .from('project_team_members')
        .insert(addedIds.map((memberId) => ({ project_id: projectId, member_id: memberId })))
      if (error) throw new Error(error.message)
    }
  },
})
