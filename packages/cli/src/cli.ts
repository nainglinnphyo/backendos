#!/usr/bin/env node
import { writeFile, access } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { runGenerate } from "./generate.js";

const program = new Command();

program.name("backendos").description("BackendOS CLI - generate type-safe database clients from your project's schema.");

program
  .command("init")
  .description("Create a backendos.config.json in the current directory")
  .option("-u, --url <url>", "Project URL (from the BackendOS dashboard)")
  .option("-o, --output <path>", "Where to write generated types", "./backendos-types.ts")
  .action(async (options: { url?: string; output: string }) => {
    const configPath = path.resolve(process.cwd(), "backendos.config.json");
    try {
      await access(configPath);
      console.error(`backendos.config.json already exists at ${configPath}`);
      process.exitCode = 1;
      return;
    } catch {
      // doesn't exist yet - good
    }
    const config = {
      url: options.url ?? "https://my-app.backendos.dev",
      output: options.output,
      accessKeyEnv: "BACKENDOS_ACCESS_KEY",
    };
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
    console.log(`Created ${configPath}`);
    console.log(`Set ${config.accessKeyEnv} in your environment, then run \`backendos generate\`.`);
  });

async function generateAction(options: { config?: string; url?: string; accessKey?: string; output?: string }) {
  try {
    const outputPath = await runGenerate({
      configPath: options.config,
      url: options.url,
      accessKey: options.accessKey,
      output: options.output,
    });
    console.log(`Generated types + client -> ${outputPath}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

for (const name of ["generate", "pull"]) {
  program
    .command(name)
    .description("Introspect your BackendOS project's schema and regenerate TypeScript types + client")
    .option("-c, --config <path>", "Path to backendos.config.json")
    .option("-u, --url <url>", "Project URL (overrides config file)")
    .option("-k, --access-key <key>", "Project access key (overrides BACKENDOS_ACCESS_KEY env var)")
    .option("-o, --output <path>", "Where to write generated types (overrides config file)")
    .action(generateAction);
}

program.parseAsync(process.argv);
