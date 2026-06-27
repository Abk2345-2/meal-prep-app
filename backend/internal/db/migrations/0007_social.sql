CREATE SCHEMA IF NOT EXISTS social;

-- Favorites
CREATE TABLE IF NOT EXISTS social.favorites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    recipe_id   TEXT NOT NULL,
    recipe_data JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, recipe_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON social.favorites(user_id);

-- Shopping list
CREATE TABLE IF NOT EXISTS social.shopping_list (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    quantity        TEXT NOT NULL DEFAULT '',
    checked         BOOLEAN NOT NULL DEFAULT false,
    from_recipe_id  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shopping_user ON social.shopping_list(user_id);

-- Saved reels (recipes from Instagram/YouTube/TikTok)
CREATE TABLE IF NOT EXISTS social.saved_reels (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    source_url   TEXT NOT NULL,
    platform     TEXT NOT NULL DEFAULT 'unknown',
    raw_title    TEXT NOT NULL DEFAULT '',
    title        TEXT NOT NULL DEFAULT '',
    image        TEXT NOT NULL DEFAULT '',
    ingredients  JSONB NOT NULL DEFAULT '[]',
    instructions TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reels_user ON social.saved_reels(user_id);

-- Share tokens
CREATE TABLE IF NOT EXISTS social.shared_recipes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    recipe_id   TEXT NOT NULL,
    recipe_data JSONB NOT NULL DEFAULT '{}',
    share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shared_token ON social.shared_recipes(share_token);
CREATE EXTENSION IF NOT EXISTS pgcrypto;
