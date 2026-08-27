import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateClientModule, type DatabaseSchema } from "@backendos/schema-engine";
import { loadConfig } from "./config.js";

export interface GenerateOptions {
  configPath?: string;
  url?: string;
  accessKey?: string;
  output?: string;
}

export async function runGenerate(opts: GenerateOptions): Promise<string> {
  const config = opts.url ? { url: opts.url, output: opts.output } : await loadConfig(opts.configPath);

  const url = (opts.url ?? config.url).replace(/\/+$/, "");
  const accessKey = opts.accessKey ?? process.env[config.accessKeyEnv ?? "BACKENDOS_ACCESS_KEY"];
  if (!accessKey) {
    throw new Error(
      `No access key found. Set ${config.accessKeyEnv ?? "BACKENDOS_ACCESS_KEY"} in your environment, or pass --access-key.`,
    );
  }
  const outputPath = path.resolve(process.cwd(), opts.output ?? config.output ?? "./backendos-types.ts");

  const res = await fetch(`${url}/v1/schema`, {
    headers: { authorization: `Bearer ${accessKey}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch schema from ${url}/v1/schema (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { data: DatabaseSchema };
  const source = generateClientModule(json.data);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, source, "utf8");

  return outputPath;
}
