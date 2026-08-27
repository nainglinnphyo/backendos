-- BackendOS control-plane metadata. Lives alongside project schemas in the same
-- Postgres instance for v1, but is logically independent of them.
CREATE SCHEMA IF NOT EXISTS backendos_meta;

CREATE TABLE IF NOT EXISTS backendos_meta.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  schema_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backendos_meta.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES backendos_meta.projects (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'default',
  display_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS api_keys_project_id_idx ON backendos_meta.api_keys (project_id);
