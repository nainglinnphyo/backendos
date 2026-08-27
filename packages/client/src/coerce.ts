/** JSON has no Date type - the API sends timestamp/date columns as ISO strings, and we turn
 * them back into real Date objects here, based on the generated runtime schema. */
export function coerceRow<T>(row: T, dateColumns: readonly string[]): T {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  for (const col of dateColumns) {
    const value = record[col];
    if (typeof value === "string") record[col] = new Date(value);
  }
  return row;
}

export function coerceRows<T>(rows: T, dateColumns: readonly string[]): T {
  if (!Array.isArray(rows)) return rows;
  for (const row of rows) coerceRow(row, dateColumns);
  return rows;
}
