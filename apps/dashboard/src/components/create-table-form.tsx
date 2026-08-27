"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTableAction, type ColumnInput } from "@/lib/actions";

const COLUMN_TYPES = [
  "uuid",
  "text",
  "varchar",
  "integer",
  "bigint",
  "smallint",
  "numeric",
  "real",
  "double precision",
  "boolean",
  "date",
  "timestamp",
  "timestamptz",
  "json",
  "jsonb",
];

function emptyColumn(): ColumnInput {
  return { name: "", type: "text", nullable: true };
}

function defaultIdColumn(): ColumnInput {
  return { name: "id", type: "uuid", primaryKey: true, nullable: false, default: { kind: "expression", value: "gen_random_uuid()" } };
}

export function CreateTableForm({ projectId }: { projectId: string }) {
  const [tableName, setTableName] = useState("");
  const [columns, setColumns] = useState<ColumnInput[]>([defaultIdColumn()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function updateColumn(index: number, patch: Partial<ColumnInput>) {
    setColumns((cols) => cols.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function submit() {
    setError(null);
    if (!tableName.trim()) {
      setError("Table name is required");
      return;
    }
    if (columns.some((c) => !c.name.trim())) {
      setError("Every column needs a name");
      return;
    }
    startTransition(async () => {
      try {
        await createTableAction(projectId, { name: tableName.trim(), columns });
        setTableName("");
        setColumns([defaultIdColumn()]);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create table");
      }
    });
  }

  return (
    <div className="card">
      <h3>Create table</h3>
      <div className="row">
        <input placeholder="table name (e.g. posts)" value={tableName} onChange={(e) => setTableName(e.target.value)} />
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Nullable</th>
            <th>PK</th>
            <th>Unique</th>
            <th>Default</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col, i) => (
            <tr key={i}>
              <td>
                <input value={col.name} onChange={(e) => updateColumn(i, { name: e.target.value })} />
              </td>
              <td>
                <select value={col.type} onChange={(e) => updateColumn(i, { type: e.target.value })}>
                  {COLUMN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={col.nullable ?? true}
                  onChange={(e) => updateColumn(i, { nullable: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={col.primaryKey ?? false}
                  onChange={(e) => updateColumn(i, { primaryKey: e.target.checked })}
                />
              </td>
              <td>
                <input type="checkbox" checked={col.unique ?? false} onChange={(e) => updateColumn(i, { unique: e.target.checked })} />
              </td>
              <td>
                <input
                  placeholder="e.g. now()"
                  value={typeof col.default?.value === "string" ? col.default.value : ""}
                  onChange={(e) => updateColumn(i, { default: e.target.value ? { kind: "expression", value: e.target.value } : null })}
                />
              </td>
              <td>
                <button type="button" onClick={() => setColumns((cols) => cols.filter((_, j) => j !== i))} disabled={columns.length === 1}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button type="button" onClick={() => setColumns((cols) => [...cols, emptyColumn()])}>
          + Add column
        </button>
        <button type="button" onClick={submit} disabled={pending}>
          {pending ? "Creating..." : "Create table"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
