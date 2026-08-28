-- Dashboard accounts. Separate concept from project API keys: this is who can log into the
-- BackendOS dashboard and manage projects, not end-user auth for projects' own data (out of
-- scope for v1, same as before).
CREATE TABLE IF NOT EXISTS backendos_meta.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  max_projects integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backendos_meta.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES backendos_meta.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON backendos_meta.sessions (user_id);

ALTER TABLE backendos_meta.projects ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES backendos_meta.users (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON backendos_meta.projects (owner_id);
