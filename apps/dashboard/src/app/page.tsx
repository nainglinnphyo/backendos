import Link from "next/link";
import { adminApi } from "@/lib/api-client";
import { createProjectAction } from "@/lib/actions";
import type { Project } from "@/lib/types";
import { TableIcon } from "@/components/icons";

export default async function HomePage() {
  const projects = await adminApi.get<Project[]>("/admin/projects");

  return (
    <div className="page-shell">
      <div className="top-header">
        <span className="brand-mark">
          <span className="brand-mark__logo">B</span>
          BackendOS
        </span>
      </div>

      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="muted">Create a project, define tables, and get a type-safe API instantly.</p>
        </div>
      </div>

      <div className="card">
        <h2>New project</h2>
        <form action={createProjectAction} className="row">
          <input name="name" placeholder="My App" required />
          <button type="submit">Create project</button>
        </form>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">No projects yet - create one above.</div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="project-card">
              <span className="project-card__icon">
                <TableIcon width={18} height={18} />
              </span>
              <div className="project-card__name">{p.name}</div>
              <div className="muted mono">{p.url}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
