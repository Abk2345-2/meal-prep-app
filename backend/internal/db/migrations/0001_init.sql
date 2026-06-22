-- Core: a shared users table + the fixed dev user.
-- Schemas isolate each microservice's tables within the one local Postgres instance.

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS pantry;
CREATE SCHEMA IF NOT EXISTS nutrition;
CREATE SCHEMA IF NOT EXISTS gamification;
CREATE SCHEMA IF NOT EXISTS recipe;

CREATE TABLE IF NOT EXISTS core.users (
    id          UUID PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT 'Dev User',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixed dev user injected by the gateway while real auth is not implemented.
INSERT INTO core.users (id, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dev User')
ON CONFLICT (id) DO NOTHING;
