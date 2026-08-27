export interface Project {
  id: string;
  name: string;
  slug: string;
  url: string;
  schemaName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  displayPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ConnectionInfo {
  isolation: string;
  schemaName: string;
  host: string;
  port: string;
  database: string;
  note: string;
}

export interface ProjectStatus {
  status: string;
  tableCount: number;
  lastIntrospectedAt: string;
}
