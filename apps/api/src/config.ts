const port = Number(process.env.PORT ?? 8787);

export const config = {
  port,
  databaseUrl: process.env.DATABASE_URL ?? "postgres://backendos:backendos@localhost:54329/backendos",
  publicApiBaseUrl: (process.env.PUBLIC_API_BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, ""),
};
