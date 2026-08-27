/** Runtime metadata emitted by `backendos generate` alongside the TS types - tells the client
 * which fields need string -> Date coercion, since JSON has no native Date type. */
export interface TableRuntimeSchema {
  dateColumns: readonly string[];
}
export type RuntimeSchema = Record<string, TableRuntimeSchema>;

export interface BackendOSConfig {
  /** The project's URL, e.g. "https://my-app.backendos.dev" (or "http://localhost:8787/p/my-app" locally). */
  url: string;
  /** The project's access key, e.g. "bko_live_xxxxx". Sent as a Bearer token. */
  accessKey: string;
  /** Runtime schema descriptor from the generated types file. Enables automatic Date coercion. */
  schema?: RuntimeSchema;
  /** Override fetch (e.g. for testing, or non-standard runtimes). Defaults to global fetch. */
  fetch?: typeof fetch;
}

/**
 * A table shape as it appears in a generated `Database` type. Constrained to `object`
 * rather than `Record<string, unknown>` on purpose: a generated Row/Insert/Update interface
 * has fixed, known keys and no index signature, so it wouldn't structurally satisfy a
 * `Record<string, unknown>` constraint even though every property matches.
 */
export interface TableShape {
  Row: object;
  Insert: object;
  Update: object;
}
export type DatabaseShape = Record<string, TableShape>;

export type FieldFilter<V> =
  | V
  | {
      equals?: V;
      not?: V;
      in?: V[];
      notIn?: V[];
      lt?: V;
      lte?: V;
      gt?: V;
      gte?: V;
      contains?: V extends string | null ? string : never;
      startsWith?: V extends string | null ? string : never;
      endsWith?: V extends string | null ? string : never;
    };

export type WhereInput<Row> = {
  [K in keyof Row]?: FieldFilter<Row[K]>;
} & {
  AND?: WhereInput<Row>[];
  OR?: WhereInput<Row>[];
  NOT?: WhereInput<Row>;
};

export type OrderDirection = "asc" | "desc";
export type OrderByInput<Row> = { [K in keyof Row]?: OrderDirection };

export type SelectResult<Row, S extends readonly (keyof Row)[] | undefined> = S extends readonly (keyof Row)[]
  ? Pick<Row, S[number]>
  : Row;

export interface FindManyArgs<Row, S extends readonly (keyof Row)[] | undefined = undefined> {
  where?: WhereInput<Row>;
  orderBy?: OrderByInput<Row> | OrderByInput<Row>[];
  limit?: number;
  offset?: number;
  select?: S;
}

export interface FindUniqueArgs<Row, S extends readonly (keyof Row)[] | undefined = undefined> {
  where: WhereInput<Row>;
  select?: S;
}

export interface UpdateArgs<Row, Update> {
  where: WhereInput<Row>;
  data: Update;
}

export interface DeleteArgs<Row> {
  where: WhereInput<Row>;
}

export interface CountArgs<Row> {
  where?: WhereInput<Row>;
}

export interface TableClient<T extends TableShape> {
  findMany<S extends readonly (keyof T["Row"])[] | undefined = undefined>(
    args?: FindManyArgs<T["Row"], S>,
  ): Promise<SelectResult<T["Row"], S>[]>;

  findUnique<S extends readonly (keyof T["Row"])[] | undefined = undefined>(
    args: FindUniqueArgs<T["Row"], S>,
  ): Promise<SelectResult<T["Row"], S> | null>;

  create<D extends T["Insert"] | T["Insert"][]>(args: { data: D }): Promise<D extends unknown[] ? T["Row"][] : T["Row"]>;

  update(args: UpdateArgs<T["Row"], T["Update"]>): Promise<T["Row"][]>;

  delete(args: DeleteArgs<T["Row"]>): Promise<T["Row"][]>;

  count(args?: CountArgs<T["Row"]>): Promise<number>;
}

/**
 * Deliberately unconstrained (not `DB extends DatabaseShape`): a generated `Database`
 * interface has known, fixed keys and no index signature, so it doesn't structurally satisfy
 * `Record<string, TableShape>` as a generic constraint even though every property matches.
 * The per-key conditional below checks the shape instead, which sidesteps that entirely.
 */
export type BackendOSClient<DB> = {
  [K in keyof DB]: DB[K] extends TableShape ? TableClient<DB[K]> : never;
};
