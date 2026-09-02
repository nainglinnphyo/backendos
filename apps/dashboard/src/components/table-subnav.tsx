import Link from "next/link";

export function TableSubNav({ projectId, table, active }: { projectId: string; table: string; active: "schema" | "data" }) {
  const base = `/projects/${projectId}/editor/${table}`;
  return (
    <div className="row" style={{ marginBottom: 20 }}>
      <Link href={base} className={`badge ${active === "schema" ? "badge-green" : "badge-gray"}`}>
        Schema
      </Link>
      <Link href={`${base}/data`} className={`badge ${active === "data" ? "badge-green" : "badge-gray"}`}>
        Data
      </Link>
    </div>
  );
}
