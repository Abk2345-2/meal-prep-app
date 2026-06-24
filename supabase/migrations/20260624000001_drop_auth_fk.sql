-- core.users.id was created with REFERENCES auth.users(id), but the Go backend
-- manages its own Google OAuth and never writes to auth.users. Drop the FK so
-- the Go upsert can insert freely.
ALTER TABLE core.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE core.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE core.users ADD PRIMARY KEY (id);
