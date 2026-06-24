-- =============================================================
-- Supabase migration: full schema for PantryToPlate
--
-- Architecture notes:
--   • core.users mirrors auth.users (Supabase's built-in auth table).
--     A trigger keeps it in sync on sign-up so app code can JOIN
--     against core.users just like before.
--   • Custom schemas (pantry, nutrition, gamification, recipe) are
--     kept exactly as in the Go codebase so zero Go query changes
--     are needed.
--   • RLS is enabled on every user-data table. Policies use
--     auth.uid() to enforce row isolation — no application-level
--     user_id filtering is required, but the Go code's WHERE
--     user_id = $1 clauses are harmless duplicates.
--   • The recipe schema holds static catalog data (no per-user rows)
--     so RLS is enabled but only a permissive SELECT policy is added.
--   • The dev-user seed rows are skipped here; use a separate seed
--     file for local development.
-- =============================================================

-- ----------------------------------------------------------------
-- 0. Create schemas first, then expose to PostgREST / Supabase client
-- ----------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS pantry;
CREATE SCHEMA IF NOT EXISTS nutrition;
CREATE SCHEMA IF NOT EXISTS gamification;
CREATE SCHEMA IF NOT EXISTS recipe;

GRANT USAGE ON SCHEMA core          TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA pantry        TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA nutrition     TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA gamification  TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA recipe        TO anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- 1. core schema — user profiles
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS core.users (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT        NOT NULL DEFAULT '',
    email        TEXT        UNIQUE,
    google_sub   TEXT        UNIQUE,
    avatar_url   TEXT,
    provider     TEXT        NOT NULL DEFAULT 'google',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automatically create a core.users row when someone signs up via
-- Supabase Auth (Google OAuth or any other provider).
CREATE OR REPLACE FUNCTION core.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO core.users (id, display_name, email, avatar_url, provider)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_app_meta_data->>'provider', 'google')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE core.handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS users_google_sub_idx ON core.users (google_sub);
CREATE INDEX IF NOT EXISTS users_email_idx      ON core.users (email);

-- RLS
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
    ON core.users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON core.users FOR UPDATE
    USING (id = auth.uid());

-- Grant table access
GRANT SELECT, UPDATE ON core.users TO authenticated;
GRANT ALL             ON core.users TO service_role;

-- ----------------------------------------------------------------
-- 2. pantry schema — ingredient inventory
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pantry.items (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID           NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    raw_text        TEXT           NOT NULL,
    name            TEXT           NOT NULL,
    normalized_name TEXT           NOT NULL,
    quantity        NUMERIC(12, 3) NOT NULL DEFAULT 1,
    unit            TEXT           NOT NULL DEFAULT 'unit',
    category        TEXT           NOT NULL DEFAULT 'other',
    added_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_user    ON pantry.items (user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_expires ON pantry.items (user_id, expires_at);

-- RLS
ALTER TABLE pantry.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pantry"
    ON pantry.items FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON pantry.items TO authenticated;
GRANT ALL                             ON pantry.items TO service_role;

-- ----------------------------------------------------------------
-- 3. nutrition schema — goals & meal logs
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nutrition.goals (
    user_id        UUID        PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
    daily_calories INTEGER     NOT NULL DEFAULT 2000,
    protein_g      INTEGER     NOT NULL DEFAULT 100,
    carbs_g        INTEGER     NOT NULL DEFAULT 250,
    fat_g          INTEGER     NOT NULL DEFAULT 65,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nutrition.meal_logs (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   UUID        NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    source    TEXT        NOT NULL,
    calories  INTEGER     NOT NULL DEFAULT 0,
    protein_g INTEGER     NOT NULL DEFAULT 0,
    carbs_g   INTEGER     NOT NULL DEFAULT 0,
    fat_g     INTEGER     NOT NULL DEFAULT 0,
    cooked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_logs_user_day ON nutrition.meal_logs (user_id, cooked_at);

-- RLS
ALTER TABLE nutrition.goals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition.meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals"
    ON nutrition.goals FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own meal logs"
    ON nutrition.meal_logs FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON nutrition.goals     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON nutrition.meal_logs TO authenticated;
GRANT ALL                             ON nutrition.goals     TO service_role;
GRANT ALL                             ON nutrition.meal_logs TO service_role;

-- ----------------------------------------------------------------
-- 4. gamification schema — points, streaks, rewards
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gamification.points_ledger (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    action     TEXT        NOT NULL,
    points     INTEGER     NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_user ON gamification.points_ledger (user_id, created_at);

CREATE TABLE IF NOT EXISTS gamification.streaks (
    user_id        UUID    PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_active    DATE
);

CREATE TABLE IF NOT EXISTS gamification.rewards (
    id            TEXT    PRIMARY KEY,
    title         TEXT    NOT NULL,
    description   TEXT    NOT NULL,
    points_needed INTEGER NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0
);

-- Reward catalog (points_needed already at v2 values)
INSERT INTO gamification.rewards (id, title, description, points_needed, sort_order) VALUES
    ('beginner',   'Beginner',             'Custom weekly summary email',        50,   1),
    ('momentum',   'Building Momentum',    'Access to 5-Minute Recipes library', 150,  2),
    ('consistent', 'Consistent',           'Early access to new features',       300,  3),
    ('resilient',  'Resilient',            'Co-design a badge with a friend',    600,  4),
    ('champion',   'Food-Saving Champion', 'Grocery discount voucher',           1000, 5)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS gamification.user_rewards (
    user_id     UUID        NOT NULL REFERENCES core.users(id)         ON DELETE CASCADE,
    reward_id   TEXT        NOT NULL REFERENCES gamification.rewards(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, reward_id)
);

-- RLS
ALTER TABLE gamification.points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification.streaks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification.rewards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification.user_rewards  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own points"
    ON gamification.points_ledger FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own streak"
    ON gamification.streaks FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Rewards catalog is public"
    ON gamification.rewards FOR SELECT
    USING (true);

CREATE POLICY "Users manage own unlocks"
    ON gamification.user_rewards FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON gamification.points_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON gamification.streaks        TO authenticated;
GRANT SELECT                          ON gamification.rewards        TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON gamification.user_rewards   TO authenticated;
GRANT ALL ON gamification.points_ledger, gamification.streaks,
            gamification.rewards, gamification.user_rewards         TO service_role;

-- ----------------------------------------------------------------
-- 5. recipe schema — static catalog (no per-user rows)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipe.recipes (
    id           TEXT    PRIMARY KEY,
    title        TEXT    NOT NULL,
    category     TEXT    NOT NULL DEFAULT '',
    area         TEXT    NOT NULL DEFAULT '',
    instructions TEXT    NOT NULL DEFAULT '',
    image        TEXT    NOT NULL DEFAULT '',
    source_url   TEXT    NOT NULL DEFAULT '',
    youtube_url  TEXT    NOT NULL DEFAULT '',
    time_minutes INTEGER NOT NULL DEFAULT 0,
    calories     INTEGER NOT NULL DEFAULT 0,
    protein_g    INTEGER NOT NULL DEFAULT 0,
    carbs_g      INTEGER NOT NULL DEFAULT 0,
    fat_g        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipe.ingredients (
    id        BIGSERIAL PRIMARY KEY,
    recipe_id TEXT      NOT NULL REFERENCES recipe.recipes(id) ON DELETE CASCADE,
    name      TEXT      NOT NULL,
    measure   TEXT      NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe.ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_recipes_category   ON recipe.recipes     (category);
CREATE INDEX IF NOT EXISTS idx_recipe_recipes_area       ON recipe.recipes     (area);

-- RLS — catalog is readable by anyone; writes only via service_role
ALTER TABLE recipe.recipes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipes catalog is public"
    ON recipe.recipes FOR SELECT
    USING (true);

CREATE POLICY "Ingredients catalog is public"
    ON recipe.ingredients FOR SELECT
    USING (true);

GRANT SELECT ON recipe.recipes, recipe.ingredients TO authenticated, anon;
GRANT ALL    ON recipe.recipes, recipe.ingredients TO service_role;
GRANT USAGE, SELECT ON SEQUENCE recipe.ingredients_id_seq TO service_role;
