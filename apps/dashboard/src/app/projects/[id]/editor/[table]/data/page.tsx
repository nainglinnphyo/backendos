import Link from "next/link";
import { notFound } from "next/navigation";
import { adminApi } from "@/lib/api-client";
import { deleteRowAction } from "@/lib/actions";
import { TableSubNav } from "@/components/table-subnav";
import type { TableSchema } from "@backendos/schema-engine";
import type { RowValue, TableRows } from "@/lib/types";

const DATE_TYPES = new Set(["date", "timestamp", "timestamptz"]);
const PAGE_SIZE = 50;

function formatCell(value: RowValue, isDate: boolean): string {
  if (value === null) return "NULL";
  if (isDate && typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function TableDataPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; table: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { id, table } = await params;
  const { offset: offsetParam } = await searchParams;
  const offset = Math.max(0, Number(offsetParam ?? 0) || 0);

  const t = await adminApi.get<TableSchema>(`/admin/projects/${id}/tables/${table}`).catch(() => null);
  if (!t) notFound();

  const { rows, total } = await adminApi.get<TableRows>(
    `/admin/projects/${id}/tables/${table}/rows?limit=${PAGE_SIZE}&offset=${offset}`,
  );

  const dateColumns = new Set(t.columns.filter((c) => DATE_TYPES.has(c.udtName)).map((c) => c.apiName));
  const columns = t.columns.map((c) => c.apiName);
  const hasPk = t.primaryKey.length > 0;

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="mono">{t.name}</h1>
          <p className="muted">
            {total === 0 ? "No rows yet" : `${from}-${to} of ${total} row${total === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <TableSubNav projectId={id} table={table} active="data" />

      {rows.length === 0 ? (
        <div className="empty-state">
          No rows yet - insert some through your app's generated client, or the data API directly.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                {hasPk && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                // `where` keys must be apiNames (what the query builder expects), not raw
                // snake_case DB column names - matters for any PK column with an underscore.
                const pkWhere = Object.fromEntries(
                  t.primaryKey.map((pk) => {
                    const apiName = t.columns.find((c) => c.name === pk)!.apiName;
                    return [apiName, row[apiName]];
                  }),
                );
                return (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c} className="mono">
                        {formatCell(row[c], dateColumns.has(c))}
                      </td>
                    ))}
                    {hasPk && (
                      <td>
                        <form action={deleteRowAction.bind(null, id, table)}>
                          <input type="hidden" name="where" value={JSON.stringify(pkWhere)} />
                          <button type="submit" className="danger">
                            Delete
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="row" style={{ marginTop: 12 }}>
          {offset === 0 ? (
            <button type="button" className="secondary" disabled>
              Prev
            </button>
          ) : (
            <Link href={`?offset=${Math.max(0, offset - PAGE_SIZE)}`}>
              <button type="button" className="secondary">
                Prev
              </button>
            </Link>
          )}
          {to >= total ? (
            <button type="button" className="secondary" disabled>
              Next
            </button>
          ) : (
            <Link href={`?offset=${offset + PAGE_SIZE}`}>
              <button type="button" className="secondary">
                Next
              </button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
