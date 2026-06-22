-- Points ledger (append-only), per-user streak state, and a reward catalog.
CREATE TABLE IF NOT EXISTS gamification.points_ledger (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    action     TEXT NOT NULL,             -- log_pantry, cook_meal, hit_goal, avoid_waste, share
    points     INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_user ON gamification.points_ledger(user_id, created_at);

CREATE TABLE IF NOT EXISTS gamification.streaks (
    user_id        UUID PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_active    DATE
);

CREATE TABLE IF NOT EXISTS gamification.rewards (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    points_needed INTEGER NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO gamification.rewards (id, title, description, points_needed, sort_order) VALUES
    ('beginner',   'Beginner',              'Custom weekly summary email',          100,  1),
    ('momentum',   'Building Momentum',     'Access to 5-Minute Recipes library',   280,  2),
    ('consistent', 'Consistent',            'Early access to new features',          520,  3),
    ('resilient',  'Resilient',             'Co-design a badge with a friend',       850,  4),
    ('champion',   'Food-Saving Champion',  'Grocery discount voucher',             1500,  5)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS gamification.user_rewards (
    user_id     UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    reward_id   TEXT NOT NULL REFERENCES gamification.rewards(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, reward_id)
);

-- Seed streak row for the dev user.
INSERT INTO gamification.streaks (user_id) VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id) DO NOTHING;
