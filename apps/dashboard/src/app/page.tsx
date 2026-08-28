import Link from "next/link";
import { adminApi } from "@/lib/api-client";
import { createProjectAction } from "@/lib/actions";
import { logoutAction } from "@/lib/auth-actions";
import type { CurrentUser, Project } from "@/lib/types";
import { TableIcon } from "@/components/icons";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [projects, me, { error }] = await Promise.all([
    adminApi.get<Project[]>("/admin/projects"),
    adminApi.get<CurrentUser>("/auth/me"),
    searchParams,
  ]);
  const atLimit = me.projectCount >= me.maxProjects;

  return (
    <div className="page-shell">
      <div className="top-header">
        <span className="brand-mark">
          <span className="brand-mark__logo">B</span>
          BackendOS
        </span>
        <div className="row" style={{ marginBottom: 0 }}>
          <span className="muted">{me.email}</span>
          <form action={logoutAction}>
            <button type="submit" className="ghost">
              Log out
            </button>
          </form>
        </div>
      </div>

      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="muted">
            {me.projectCount} / {me.maxProjects} projects used
          </p>
        </div>
      </div>

      {error && (
        <div className="banner banner-warn">
          <strong>{error}</strong>
        </div>
      )}

      {atLimit ? (
        <div className="banner banner-warn">
          <strong>Project limit reached</strong>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            You&apos;re using all {me.maxProjects} of your projects. Delete one to create another.
          </p>
        </div>
      ) : (
        <div className="card">
          <h2>New project</h2>
          <form action={createProjectAction} className="row">
            <input name="name" placeholder="My App" required />
            <button type="submit">Create project</button>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">No projects yet{atLimit ? "." : " - create one above."}</div>
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
