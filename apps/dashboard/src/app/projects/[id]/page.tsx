import { notFound } from "next/navigation";
import { adminApi } from "@/lib/api-client";
import { takeReveal } from "@/lib/reveal-store";
import type { ApiKeySummary, Project, ProjectStatus } from "@/lib/types";
import { KeyIcon, SettingsIcon, TableIcon } from "@/components/icons";

export default async function ProjectOverviewPage({
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

  const [status, apiKeys] = await Promise.all([
    adminApi.get<ProjectStatus>(`/admin/projects/${id}/status`),
    adminApi.get<ApiKeySummary[]>(`/admin/projects/${id}/api-keys`),
  ]);

  const activeKeys = apiKeys.filter((k) => !k.revokedAt).length;

  return (
    <div>
      {revealedKey && (
        <div className="banner banner-warn">
          <strong>Your new API key - copy it now, it won&apos;t be shown again:</strong>
          <pre className="mono">{revealedKey}</pre>
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>{project.name}</h1>
          <div className="row" style={{ marginTop: 6 }}>
            <span className="badge badge-green">
              <span className="badge-dot" /> {status.status}
            </span>
            <span className="pill">{project.url}</span>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Tables</div>
          <div className="stat-card__value">{status.tableCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Active API keys</div>
          <div className="stat-card__value">{activeKeys}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Isolation</div>
          <div className="stat-card__value" style={{ fontSize: 14 }}>
            Schema-per-project
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 0 }}>Quick links</h3>
      <div className="quick-link-grid">
        <a className="quick-link-card" href={`/projects/${id}/editor`}>
          <span className="quick-link-card__icon">
            <TableIcon />
          </span>
          <div>
            <div className="quick-link-card__title">Table Editor</div>
            <div className="quick-link-card__desc">Create and manage tables, columns, and constraints.</div>
          </div>
        </a>
        <a className="quick-link-card" href={`/projects/${id}/api-keys`}>
          <span className="quick-link-card__icon">
            <KeyIcon />
          </span>
          <div>
            <div className="quick-link-card__title">API Keys</div>
            <div className="quick-link-card__desc">Generate, revoke, and rotate access keys.</div>
          </div>
        </a>
        <a className="quick-link-card" href={`/projects/${id}/settings`}>
          <span className="quick-link-card__icon">
            <SettingsIcon />
          </span>
          <div>
            <div className="quick-link-card__title">Settings</div>
            <div className="quick-link-card__desc">Rename, view connection info, or delete this project.</div>
          </div>
        </a>
      </div>

      <h3>Connect from your app</h3>
      <div className="card">
        <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {`import { createBackendOS } from "./backendos-types";

const backendos = createBackendOS({
  url: "${project.url}",
  accessKey: process.env.BACKENDOS_ACCESS_KEY!,
});`}
        </pre>
      </div>
    </div>
  );
}
