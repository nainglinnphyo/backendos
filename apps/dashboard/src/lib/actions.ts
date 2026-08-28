"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminApi, AdminApiError } from "./api-client";
import { stashReveal } from "./reveal-store";
import type { Project } from "./types";

function parseColumnsField(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Revalidates every page nested under a project (sidebar table list + whichever page is showing). */
function revalidateProject(projectId: string): void {
  revalidatePath(`/projects/${projectId}`, "layout");
}

// ---- Projects ----

export async function createProjectAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Project name is required");

  let result: { project: Project; apiKey: { key: string } };
  try {
    result = await adminApi.post<{ project: Project; apiKey: { key: string } }>("/admin/projects", { name });
  } catch (err) {
    if (err instanceof AdminApiError && err.status === 403) {
      redirect(`/?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
  const token = stashReveal(result.apiKey.key);
  revalidatePath("/");
  redirect(`/projects/${result.project.id}?reveal=${token}`);
}

export async function renameProjectAction(projectId: string, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Project name is required");
  await adminApi.patch(`/admin/projects/${projectId}`, { name });
  revalidateProject(projectId);
  revalidatePath("/");
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  await adminApi.delete(`/admin/projects/${projectId}`);
  revalidatePath("/");
  redirect("/");
}

// ---- API keys ----

export async function createApiKeyAction(projectId: string, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim() || "default";
  const result = await adminApi.post<{ key: string }>(`/admin/projects/${projectId}/api-keys`, { name });
  const token = stashReveal(result.key);
  revalidatePath(`/projects/${projectId}/api-keys`);
  redirect(`/projects/${projectId}/api-keys?reveal=${token}`);
}

export async function revokeApiKeyAction(projectId: string, keyId: string): Promise<void> {
  await adminApi.delete(`/admin/projects/${projectId}/api-keys/${keyId}`);
  revalidatePath(`/projects/${projectId}/api-keys`);
}

export async function regenerateApiKeyAction(projectId: string, keyId: string): Promise<void> {
  const result = await adminApi.post<{ key: string }>(`/admin/projects/${projectId}/api-keys/${keyId}/regenerate`, {});
  const token = stashReveal(result.key);
  revalidatePath(`/projects/${projectId}/api-keys`);
  redirect(`/projects/${projectId}/api-keys?reveal=${token}`);
}

// ---- Tables ----

export interface ColumnInput {
  name: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
  default?: { kind: "literal" | "expression"; value: string | number | boolean | null } | null;
  primaryKey?: boolean;
  unique?: boolean;
}

export async function createTableAction(projectId: string, input: { name: string; columns: ColumnInput[] }): Promise<void> {
  await adminApi.post(`/admin/projects/${projectId}/tables`, input);
  revalidateProject(projectId);
}

export async function deleteTableAction(projectId: string, table: string): Promise<void> {
  await adminApi.delete(`/admin/projects/${projectId}/tables/${table}`);
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/editor`);
}

export async function renameTableAction(projectId: string, table: string, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Table name is required");
  await adminApi.patch(`/admin/projects/${projectId}/tables/${table}`, { name });
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/editor/${name}`);
}

export async function addColumnAction(projectId: string, table: string, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "text");
  const nullable = formData.get("nullable") === "on";
  const unique = formData.get("unique") === "on";
  const defaultExpr = String(formData.get("defaultExpr") ?? "").trim();

  await adminApi.post(`/admin/projects/${projectId}/tables/${table}/columns`, {
    name,
    type,
    nullable,
    unique,
    default: defaultExpr ? { kind: "expression", value: defaultExpr } : undefined,
  });
  revalidateProject(projectId);
}

export async function dropColumnAction(projectId: string, table: string, column: string): Promise<void> {
  await adminApi.delete(`/admin/projects/${projectId}/tables/${table}/columns/${column}`);
  revalidateProject(projectId);
}

export async function renameColumnAction(projectId: string, table: string, column: string, formData: FormData): Promise<void> {
  const newName = String(formData.get("newName") ?? "").trim();
  if (!newName) throw new Error("New column name is required");
  await adminApi.patch(`/admin/projects/${projectId}/tables/${table}/columns/${column}`, { newName });
  revalidateProject(projectId);
}

export async function alterColumnNullableAction(projectId: string, table: string, column: string, nullable: boolean): Promise<void> {
  await adminApi.patch(`/admin/projects/${projectId}/tables/${table}/columns/${column}`, { nullable });
  revalidateProject(projectId);
}

export async function addUniqueConstraintAction(projectId: string, table: string, formData: FormData): Promise<void> {
  const columns = parseColumnsField(formData.get("columns"));
  if (columns.length === 0) throw new Error("At least one column is required");
  await adminApi.post(`/admin/projects/${projectId}/tables/${table}/unique-constraints`, { columns });
  revalidateProject(projectId);
}

export async function addForeignKeyAction(projectId: string, table: string, formData: FormData): Promise<void> {
  const columns = parseColumnsField(formData.get("columns"));
  const referencedTable = String(formData.get("referencedTable") ?? "").trim();
  const referencedColumns = parseColumnsField(formData.get("referencedColumns"));
  const onDelete = String(formData.get("onDelete") ?? "no action");
  if (columns.length === 0 || !referencedTable || referencedColumns.length === 0) {
    throw new Error("Columns, referenced table, and referenced columns are required");
  }
  await adminApi.post(`/admin/projects/${projectId}/tables/${table}/foreign-keys`, {
    columns,
    referencedTable,
    referencedColumns,
    onDelete,
  });
  revalidateProject(projectId);
}

export async function dropConstraintAction(projectId: string, table: string, name: string): Promise<void> {
  await adminApi.delete(`/admin/projects/${projectId}/tables/${table}/constraints/${name}`);
  revalidateProject(projectId);
}

export async function createIndexAction(projectId: string, table: string, formData: FormData): Promise<void> {
  const columns = parseColumnsField(formData.get("columns"));
  const unique = formData.get("unique") === "on";
  if (columns.length === 0) throw new Error("At least one column is required");
  await adminApi.post(`/admin/projects/${projectId}/tables/${table}/indexes`, { columns, unique });
  revalidateProject(projectId);
}

export async function dropIndexAction(projectId: string, table: string, name: string): Promise<void> {
  await adminApi.delete(`/admin/projects/${projectId}/tables/${table}/indexes/${name}`);
  revalidateProject(projectId);
}
