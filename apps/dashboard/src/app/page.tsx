import Link from "next/link";
import { adminApi } from "@/lib/api-client";
import { createProjectAction } from "@/lib/actions";
import type { Project } from "@/lib/types";

export default async function HomePage() {
  const projects = await adminApi.get<Project[]>("/admin/projects");

  return (
    <main>
      <header className="page-header">
        <h1>BackendOS</h1>
        <p className="muted">Create a project, define tables, and get a type-safe API instantly.</p>
      </header>

      <section className="card">
        <h2>New project</h2>
        <form action={createProjectAction} className="row">
          <input name="name" placeholder="My App" required />
          <button type="submit">Create project</button>
        </form>
      </section>

      <section>
        <h2>Projects</h2>
        {projects.length === 0 ? (
          <p className="muted">No projects yet - create one above.</p>
        ) : (
          <ul className="list">
            {projects.map((p) => (
              <li key={p.id} className="card">
                <Link href={`/projects/${p.id}`}>
                  <strong>{p.name}</strong>
                </Link>
                <div className="muted mono">{p.url}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
