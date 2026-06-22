-- Daily nutrition goal (one row per user) and the meals they log.
CREATE TABLE IF NOT EXISTS nutrition.goals (
    user_id        UUID PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
    daily_calories INTEGER NOT NULL DEFAULT 2000,
    protein_g      INTEGER NOT NULL DEFAULT 100,
    carbs_g        INTEGER NOT NULL DEFAULT 250,
    fat_g          INTEGER NOT NULL DEFAULT 65,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nutrition.meal_logs (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    source     TEXT NOT NULL,              -- recipe id or free-text meal name
    calories   INTEGER NOT NULL DEFAULT 0,
    protein_g  INTEGER NOT NULL DEFAULT 0,
    carbs_g    INTEGER NOT NULL DEFAULT 0,
    fat_g      INTEGER NOT NULL DEFAULT 0,
    cooked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_logs_user_day ON nutrition.meal_logs(user_id, cooked_at);

-- Seed a default goal for the dev user.
INSERT INTO nutrition.goals (user_id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id) DO NOTHING;
