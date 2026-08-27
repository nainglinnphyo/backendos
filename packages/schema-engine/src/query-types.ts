export type FilterValue = string | number | boolean | null;

export interface FieldFilterObject {
  equals?: FilterValue;
  not?: FilterValue;
  in?: FilterValue[];
  notIn?: FilterValue[];
  lt?: FilterValue;
  lte?: FilterValue;
  gt?: FilterValue;
  gte?: FilterValue;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
}

export interface WhereInput {
  [column: string]: FilterValue | FieldFilterObject | WhereInput[] | WhereInput | undefined;
  AND?: WhereInput[];
  OR?: WhereInput[];
  NOT?: WhereInput;
}

export type OrderDirection = "asc" | "desc";
export type OrderByInput = Record<string, OrderDirection>;

export interface FindManyQuery {
  where?: WhereInput;
  orderBy?: OrderByInput | OrderByInput[];
  limit?: number;
  offset?: number;
  select?: string[];
}

export interface FindUniqueQuery {
  where: WhereInput;
  select?: string[];
}

export interface CreateQuery {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export interface UpdateQuery {
  where: WhereInput;
  data: Record<string, unknown>;
}

export interface DeleteQuery {
  where: WhereInput;
}

export interface CountQuery {
  where?: WhereInput;
}

export class QueryValidationError extends Error {
  code = "QUERY_VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "QueryValidationError";
  }
}
