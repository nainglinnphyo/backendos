import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { adminApi } from "@/lib/api-client";
import { ProjectChrome } from "@/components/project-chrome";
import type { Project } from "@/lib/types";
import type { TableSchema } from "@backendos/schema-engine";

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await adminApi.get<Project>(`/admin/projects/${id}`).catch(() => null);
  if (!project) notFound();

  const tables = await adminApi.get<TableSchema[]>(`/admin/projects/${id}/tables`);

  return (
    <ProjectChrome projectId={id} projectName={project.name} tables={tables.map((t) => ({ name: t.name }))}>
      {children}
    </ProjectChrome>
  );
}
