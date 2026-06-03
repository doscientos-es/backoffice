"use client";

import { ListPage, type ListPageProps } from "@/components/layout/list-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useState } from "react";
import { ProjectQuickView, type QuickProject } from "./project-quick-view";

export function ProjectsList({
  canEdit = false,
  ...props
}: ListPageProps & { canEdit?: boolean }) {
  const [selectedProject, setSelectedProject] = useState<QuickProject | null>(null);

  return (
    <>
      <ListPage {...props} onRowClick={(row) => setSelectedProject(row.data as QuickProject)} />
      <ErrorBoundary>
        <ProjectQuickView
          project={selectedProject}
          canEdit={canEdit}
          onCloseAction={() => setSelectedProject(null)}
        />
      </ErrorBoundary>
    </>
  );
}
