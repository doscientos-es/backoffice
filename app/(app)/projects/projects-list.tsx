'use client'

import { lazy, useState } from 'react'

import { ListPage, type ListPageProps } from '@/components/layout/list-page'
import { DeferredContent } from '@/components/ui/deferred-content'
import { useOptimisticRemoval } from '@/lib/hooks/use-optimistic-removal'

import { deleteProject } from './actions'
import type { QuickProject } from './project-quick-view'

const ProjectQuickView = lazy(() =>
  import('./project-quick-view').then((module) => ({ default: module.ProjectQuickView })),
)

export function ProjectsList({
  canEdit = false,
  ...props
}: ListPageProps<QuickProject> & { canEdit?: boolean }) {
  const [selectedProject, setSelectedProject] = useState<QuickProject | null>(null)
  const { items: rows, remove } = useOptimisticRemoval(props.rows)

  const handleDelete = (id: string) => {
    // Close the drawer immediately; the row vanishes optimistically and
    // reappears (with a toast) if the server rejects the delete.
    setSelectedProject(null)
    remove(id, () => deleteProject({ id }), {
      errorMessage: 'No se pudo eliminar el proyecto',
    })
  }

  return (
    <>
      <ListPage {...props} rows={rows} onRowClick={(row) => setSelectedProject(row.data ?? null)} />
      <DeferredContent active={selectedProject !== null}>
        <ProjectQuickView
          project={selectedProject}
          canEdit={canEdit}
          onDeleteAction={handleDelete}
          onCloseAction={() => setSelectedProject(null)}
        />
      </DeferredContent>
    </>
  )
}
