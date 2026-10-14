'use server'

import { defineAction } from '@/lib/actions/define-action'
import { VersionConflictError } from '@/lib/concurrency/version-conflict'
import { LinkProjectRepositoryInput } from '@/lib/schemas/developer-workflow'
import { createServerClient } from '@/lib/supabase/server'

export const linkProjectRepository = defineAction({
  name: 'projects.linkRepository',
  schema: LinkProjectRepositoryInput,
  roles: ['owner', 'admin', 'member'],
  revalidate: (_payload, input) => ['/projects', `/projects/${input.projectId}`],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('link_project_repository', {
      p_project_id: input.projectId,
      p_expected_version: input.expectedVersion,
      p_repository: input.repository,
    })
    if (error?.code === '40001') throw new VersionConflictError()
    if (error) throw error
    return data as { version: number }
  },
})
