import Link from "next/link";
import { adminApi } from "@/lib/api-client";
import { CreateTableForm } from "@/components/create-table-form";
import type { TableSchema } from "@backendos/schema-engine";
import { TableIcon } from "@/components/icons";

export default async function TableEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tables = await adminApi.get<TableSchema[]>(`/admin/projects/${id}/tables`);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Table Editor</h1>
          <p className="muted">Define your schema - BackendOS turns it into an API and generated types automatically.</p>
        </div>
      </div>

      <CreateTableForm projectId={id} />

      {tables.length === 0 ? (
        <div className="empty-state">No tables yet - create one above.</div>
      ) : (
        <ul className="list">
          {tables.map((t) => (
            <li key={t.name}>
              <Link href={`/projects/${id}/editor/${t.name}`} className="project-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="project-card__icon" style={{ marginBottom: 0 }}>
                  <TableIcon width={16} height={16} />
                </span>
                <div>
                  <div className="project-card__name mono" style={{ marginBottom: 0 }}>
                    {t.name}
                  </div>
                  <div className="muted">{t.columns.length} columns</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
