import Link from "next/link";
import { notFound } from "next/navigation";
import { adminApi } from "@/lib/api-client";
import { takeReveal } from "@/lib/reveal-store";
import { renameProjectAction, deleteProjectAction, createApiKeyAction, revokeApiKeyAction, regenerateApiKeyAction } from "@/lib/actions";
import { CreateTableForm } from "@/components/create-table-form";
import type { ApiKeySummary, ConnectionInfo, Project, ProjectStatus } from "@/lib/types";
import type { TableSchema } from "@backendos/schema-engine";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reveal?: string }>;
}) {
  const { id } = await params;
  const { reveal } = await searchParams;
  const revealedKey = takeReveal(reveal);

  const project = await adminApi.get<Project>(`/admin/projects/${id}`).catch(() => null);
  if (!project) notFound();

  const [apiKeys, connection, status, tables] = await Promise.all([
    adminApi.get<ApiKeySummary[]>(`/admin/projects/${id}/api-keys`),
    adminApi.get<ConnectionInfo>(`/admin/projects/${id}/connection`),
    adminApi.get<ProjectStatus>(`/admin/projects/${id}/status`),
    adminApi.get<TableSchema[]>(`/admin/projects/${id}/tables`),
  ]);

  return (
    <main>
      <p>
        <Link href="/">&larr; All projects</Link>
      </p>

      {revealedKey && (
        <div className="banner banner-warn">
          <strong>Your new API key - copy it now, it won&apos;t be shown again:</strong>
          <pre className="mono">{revealedKey}</pre>
        </div>
      )}

      <header className="page-header">
        <h1>{project.name}</h1>
        <p className="muted mono">{project.url}</p>
        <p className="muted">
          Schema: {project.schemaName} · Status: {status.status} · Tables: {status.tableCount}
        </p>
      </header>

      <section className="card">
        <h2>Settings</h2>
        <form action={renameProjectAction.bind(null, id)} className="row">
          <input name="name" defaultValue={project.name} required />
          <button type="submit">Rename</button>
        </form>
        <form action={deleteProjectAction.bind(null, id)}>
          <button type="submit" className="danger">
            Delete project
          </button>
        </form>
      </section>

      <section className="card">
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
        <p className="muted">{connection.note}</p>
      </section>

      <section className="card">
        <h2>API keys</h2>
        <form action={createApiKeyAction.bind(null, id)} className="row">
          <input name="name" placeholder="key name (optional)" />
          <button type="submit">Generate key</button>
        </form>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Created</th>
              <th>Last used</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className="mono">{k.displayPrefix}...</td>
                <td>{new Date(k.createdAt).toLocaleString()}</td>
                <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}</td>
                <td>{k.revokedAt ? "revoked" : "active"}</td>
                <td>
                  {!k.revokedAt && (
                    <div className="row">
                      <form action={regenerateApiKeyAction.bind(null, id, k.id)}>
                        <button type="submit">Regenerate</button>
                      </form>
                      <form action={revokeApiKeyAction.bind(null, id, k.id)}>
                        <button type="submit" className="danger">
                          Revoke
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Tables</h2>
        <CreateTableForm projectId={id} />
        {tables.length === 0 ? (
          <p className="muted">No tables yet - create one above.</p>
        ) : (
          <ul className="list">
            {tables.map((t) => (
              <li key={t.name} className="card">
                <Link href={`/projects/${id}/tables/${t.name}`}>
                  <strong>{t.name}</strong>
                </Link>
                <div className="muted">{t.columns.length} columns</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
