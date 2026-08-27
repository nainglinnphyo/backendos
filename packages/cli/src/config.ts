import { readFile } from "node:fs/promises";
import path from "node:path";

export interface BackendOSProjectConfig {
  /** The project's URL, e.g. "http://localhost:8787/p/my-app" or "https://my-app.backendos.dev" */
  url: string;
  /** Where to write the generated types + client. Defaults to "./backendos-types.ts" */
  output?: string;
  /** Env var to read the access key from. Defaults to "BACKENDOS_ACCESS_KEY". */
  accessKeyEnv?: string;
}

const DEFAULT_CONFIG_FILE = "backendos.config.json";

export async function loadConfig(configPath?: string): Promise<BackendOSProjectConfig> {
  const file = configPath ?? DEFAULT_CONFIG_FILE;
  let raw: string;
  try {
    raw = await readFile(path.resolve(process.cwd(), file), "utf8");
  } catch {
    throw new Error(
      `Could not find "${file}" in ${process.cwd()}. Run \`backendos init\` first, or pass --url/--access-key directly.`,
    );
  }
  const parsed = JSON.parse(raw) as BackendOSProjectConfig;
  if (!parsed.url) throw new Error(`"${file}" is missing required field "url"`);
  return parsed;
}
