import { notFound } from "next/navigation";
import { adminApi } from "@/lib/api-client";
import type { TableSchema } from "@backendos/schema-engine";
import {
  addColumnAction,
  addForeignKeyAction,
  addUniqueConstraintAction,
  alterColumnNullableAction,
  createIndexAction,
  deleteTableAction,
  dropColumnAction,
  dropConstraintAction,
  dropIndexAction,
  renameColumnAction,
  renameTableAction,
} from "@/lib/actions";

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

export default async function TablePage({ params }: { params: Promise<{ id: string; table: string }> }) {
  const { id, table } = await params;
  const t = await adminApi.get<TableSchema>(`/admin/projects/${id}/tables/${table}`).catch(() => null);
  if (!t) notFound();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="mono">{t.name}</h1>
          <p className="muted">Primary key: {t.primaryKey.join(", ") || "none"}</p>
        </div>
      </div>

      <div className="card">
        <h2>Rename / delete table</h2>
        <form action={renameTableAction.bind(null, id, table)} className="row">
          <input name="name" defaultValue={t.name} required />
          <button type="submit">Rename</button>
        </form>
        <form action={deleteTableAction.bind(null, id, table)}>
          <button type="submit" className="danger">
            Delete table
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Columns</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Nullable</th>
              <th>Default</th>
              <th>Flags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {t.columns.map((c) => (
              <tr key={c.name}>
                <td className="mono">{c.name}</td>
                <td>
                  <span className="badge badge-gray">{c.udtName}</span>
                </td>
                <td>{c.isNullable ? "yes" : "no"}</td>
                <td className="mono">{c.columnDefault ?? "-"}</td>
                <td>
                  <div className="row" style={{ marginBottom: 0 }}>
                    {c.isPrimaryKey && <span className="badge badge-green">PK</span>}
                    {c.isUnique && !c.isPrimaryKey && <span className="badge badge-gray">unique</span>}
                  </div>
                </td>
                <td>
                  <div className="row" style={{ marginBottom: 0 }}>
                    <form action={renameColumnAction.bind(null, id, table, c.name)} className="row" style={{ marginBottom: 0 }}>
                      <input name="newName" placeholder="rename to" size={10} />
                      <button type="submit" className="secondary">
                        Rename
                      </button>
                    </form>
                    <form action={alterColumnNullableAction.bind(null, id, table, c.name, !c.isNullable)}>
                      <button type="submit" className="secondary">
                        {c.isNullable ? "Make NOT NULL" : "Make nullable"}
                      </button>
                    </form>
                    <form action={dropColumnAction.bind(null, id, table, c.name)}>
                      <button type="submit" className="danger">
                        Drop
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Add column</h3>
        <form action={addColumnAction.bind(null, id, table)} className="row">
          <input name="name" placeholder="column name" required />
          <select name="type" defaultValue="text">
            {COLUMN_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {ty}
              </option>
            ))}
          </select>
          <label>
            <input type="checkbox" name="nullable" defaultChecked /> nullable
          </label>
          <label>
            <input type="checkbox" name="unique" /> unique
          </label>
          <input name="defaultExpr" placeholder="default (e.g. now())" />
          <button type="submit">Add column</button>
        </form>
      </div>

      <div className="card">
        <h2>Unique constraints</h2>
        <ul className="list">
          {t.uniqueConstraints.map((u) => (
            <li key={u.name} className="row">
              <span className="pill">{u.name}</span>
              <span className="muted">({u.columns.join(", ")})</span>
              <form action={dropConstraintAction.bind(null, id, table, u.name)}>
                <button type="submit" className="danger">
                  Drop
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addUniqueConstraintAction.bind(null, id, table)} className="row">
          <input name="columns" placeholder="columns (comma-separated)" required />
          <button type="submit">Add unique constraint</button>
        </form>
      </div>

      <div className="card">
        <h2>Foreign keys</h2>
        <ul className="list">
          {t.foreignKeys.map((fk) => (
            <li key={fk.name} className="row">
              <span className="pill">{fk.name}</span>
              <span className="muted">
                ({fk.columns.join(", ")}) &rarr; {fk.referencedTable}({fk.referencedColumns.join(", ")})
              </span>
              <form action={dropConstraintAction.bind(null, id, table, fk.name)}>
                <button type="submit" className="danger">
                  Drop
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addForeignKeyAction.bind(null, id, table)} className="row">
          <input name="columns" placeholder="local columns" required />
          <input name="referencedTable" placeholder="referenced table" required />
          <input name="referencedColumns" placeholder="referenced columns" required />
          <select name="onDelete" defaultValue="no action">
            <option value="no action">NO ACTION</option>
            <option value="cascade">CASCADE</option>
            <option value="set null">SET NULL</option>
            <option value="restrict">RESTRICT</option>
          </select>
          <button type="submit">Add foreign key</button>
        </form>
      </div>

      <div className="card">
        <h2>Indexes</h2>
        <ul className="list">
          {t.indexes
            .filter((ix) => !ix.isPrimary)
            .map((ix) => (
              <li key={ix.name} className="row">
                <span className="pill">{ix.name}</span>
                <span className="muted">
                  ({ix.columns.join(", ")}) {ix.isUnique ? "UNIQUE" : ""} - {ix.method}
                </span>
                <form action={dropIndexAction.bind(null, id, table, ix.name)}>
                  <button type="submit" className="danger">
                    Drop
                  </button>
                </form>
              </li>
            ))}
        </ul>
        <form action={createIndexAction.bind(null, id, table)} className="row">
          <input name="columns" placeholder="columns (comma-separated)" required />
          <label>
            <input type="checkbox" name="unique" /> unique
          </label>
          <button type="submit">Create index</button>
        </form>
      </div>
    </div>
  );
}
