import { adminApi } from "@/lib/api-client";
import { takeReveal } from "@/lib/reveal-store";
import { createApiKeyAction, regenerateApiKeyAction, revokeApiKeyAction } from "@/lib/actions";
import type { ApiKeySummary } from "@/lib/types";

export default async function ApiKeysPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reveal?: string }>;
}) {
  const { id } = await params;
  const { reveal } = await searchParams;
  const revealedKey = takeReveal(reveal);

  const apiKeys = await adminApi.get<ApiKeySummary[]>(`/admin/projects/${id}/api-keys`);

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
          <h1>API Keys</h1>
          <p className="muted">
            Project-level keys identify your project - send them as <code className="mono">Authorization: Bearer bko_live_...</code>.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Generate a new key</h2>
        <form action={createApiKeyAction.bind(null, id)} className="row">
          <input name="name" placeholder="key name (optional)" />
          <button type="submit">Generate key</button>
        </form>
      </div>

      {apiKeys.length === 0 ? (
        <div className="empty-state">No API keys yet.</div>
      ) : (
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
                <td>
                  <span className="pill">{k.displayPrefix}...</span>
                </td>
                <td className="muted">{new Date(k.createdAt).toLocaleString()}</td>
                <td className="muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}</td>
                <td>
                  <span className={`badge ${k.revokedAt ? "badge-red" : "badge-green"}`}>
                    <span className="badge-dot" /> {k.revokedAt ? "revoked" : "active"}
                  </span>
                </td>
                <td>
                  {!k.revokedAt && (
                    <div className="row" style={{ marginBottom: 0 }}>
                      <form action={regenerateApiKeyAction.bind(null, id, k.id)}>
                        <button type="submit" className="secondary">
                          Regenerate
                        </button>
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
      )}
    </div>
  );
}
