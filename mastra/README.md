# Genesis Mastra Workspace

This workspace is the deploy target for Genesis agents on Mastra Platform.

## Andrew

`Andrew` is the v1 Life in Colour backend. It:

- accepts one uploaded source photo
- normalizes the colouring-page brief
- applies the selected outline mode
- generates one premium black-and-white page
- critiques it once and retries with refinements when needed
- persists the image and metadata back to Supabase

## Local commands

```bash
bun run dev:mastra
bun run type-check:mastra
bun run test:mastra
bun run mastra:build
```

Or from this directory:

```bash
bun run dev
bun run type-check
bun run test
bun run build
bun run start
```

## Required environment

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_APP_URL` for CORS in local/deployed app flows
- `MASTRA_SERVER_PORT` optional, defaults to `4111`
- `MASTRA_LIBSQL_URL` optional, defaults to `file:./.mastra/andrew.db`
- `CLICKHOUSE_URL`, `CLICKHOUSE_USERNAME`, `CLICKHOUSE_PASSWORD` for production observability
- `MASTRA_API_TOKEN` for Mastra Cloud deploys
- `MASTRA_ORG_ID` and `MASTRA_PROJECT_ID` only if you want to override `.mastra-project.json`

## Mastra Platform

Set the Mastra directory to `mastra` at the repo root when deploying this project.

For Mastra Cloud, import the repository under Lorenzo's Organization and point the deployment settings at:

- Project root: repository root
- Mastra directory: `mastra`
- Branch: `main`
- Environment variables: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_APP_URL`, `MASTRA_API_TOKEN`

Andrew uses DuckDB-backed observability in development and ClickHouse-backed observability in production. That split is controlled by `NODE_ENV`:

- `development` -> `DuckDBStore().observability`
- `production` -> `ObservabilityStorageClickhouse`

The workflow, tools, scorer, and dataset live in the `mastra/` workspace so Mastra Studio can inspect traces, logs, metrics, scorers, datasets, and experiments without pulling the rest of Genesis into the same runtime.

For the CLI path, the documented commands are:

```bash
bun run mastra:build
bun run mastra:deploy
bun run mastra:studio
```

The deploy helper reads `.mastra-project.json` for the org/project identifiers when `MASTRA_ORG_ID` and `MASTRA_PROJECT_ID` are not set.
