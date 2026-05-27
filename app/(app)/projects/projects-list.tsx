"use client";

import { ListPage, type ListPageProps } from "@/components/layout/list-page";
import { useState } from "react";
import { ProjectQuickView, type QuickProject } from "./project-quick-view";

export function ProjectsList(props: ListPageProps) {
  const [selectedProject, setSelectedProject] = useState<QuickProject | null>(null);

  return (
    <>
      <ListPage {...props} onRowClick={(row) => setSelectedProject(row.data as QuickProject)} />
      <ProjectQuickView project={selectedProject} onClose={() => setSelectedProject(null)} />
    </>
  );
}
