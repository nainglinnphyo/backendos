import { notFound } from "next/navigation";
import { adminApi } from "@/lib/api-client";
import { deleteProjectAction, renameProjectAction } from "@/lib/actions";
import type { ConnectionInfo, Project } from "@/lib/types";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await adminApi.get<Project>(`/admin/projects/${id}`).catch(() => null);
  if (!project) notFound();

  const connection = await adminApi.get<ConnectionInfo>(`/admin/projects/${id}/connection`);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
        </div>
      </div>

      <div className="card">
        <h2>General</h2>
        <form action={renameProjectAction.bind(null, id)} className="row">
          <label htmlFor="name">Project name</label>
          <input id="name" name="name" defaultValue={project.name} required />
          <button type="submit">Rename</button>
        </form>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>Slug</dt>
          <dd className="mono">{project.slug}</dd>
          <dt>Project URL</dt>
          <dd className="mono">{project.url}</dd>
          <dt>Created</dt>
          <dd className="muted">{new Date(project.createdAt).toLocaleString()}</dd>
        </dl>
      </div>

      <div className="card">
        <h2>Connection info</h2>
        <dl className="kv">
          <dt>Isolation</dt>
          <dd>{connection.isolation}</dd>
          <dt>Schema</dt>
          <dd className="mono">{connection.schemaName}</dd>
          <dt>Host</dt>
          <dd className="mono">
            {connection.host}:{connection.port}
          </dd>
          <dt>Database</dt>
          <dd className="mono">{connection.database}</dd>
        </dl>
        <p className="muted" style={{ marginBottom: 0 }}>
          {connection.note}
        </p>
      </div>

      <div className="card" style={{ borderColor: "var(--danger-border)" }}>
        <h2 style={{ color: "var(--danger)" }}>Danger zone</h2>
        <p className="muted">Deleting a project drops its schema and all data permanently. This cannot be undone.</p>
        <form action={deleteProjectAction.bind(null, id)}>
          <button type="submit" className="danger">
            Delete project
          </button>
        </form>
      </div>
    </div>
  );
}
