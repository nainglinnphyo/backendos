# BackendOS example: plain Node.js app

A minimal script that connects to a real BackendOS project and exercises the generated,
type-safe client: create, findMany (with filtering/sorting/limit/field-selection),
findUnique, update, count, delete.

## Run it

From the repo root (this example lives inside the pnpm workspace, so `@backendos/client` and
the `backendos` CLI resolve locally without needing to publish anything to npm):

```bash
pnpm install
pnpm --filter @backendos/schema-engine build
pnpm --filter @backendos/client build
pnpm --filter @backendos/cli build

pnpm dev:api          # in one terminal - the BackendOS API server must be running
```

In another terminal, from `examples/node-app`:

```bash
cp .env.example .env
# edit .env and paste a real access key from the dashboard (Project -> API Keys -> Generate key)

pnpm generate         # introspects the project's schema -> writes ./backendos-types.ts
pnpm start            # runs src/index.ts
```

`backendos.config.json` points at `http://localhost:8787/p/proj1` - change it to whichever
project you want to use (the URL shown on that project's dashboard page).

## Outside this monorepo

A real external project wouldn't have workspace-linked packages. Once `@backendos/client` and
`@backendos/cli` are published to npm, the only difference is `npm install @backendos/client`
and `npx @backendos/cli generate` instead of the `pnpm --filter` commands above - everything
else (the config file, the generated types, the script) is identical.
