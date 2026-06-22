-- Pantry items the user owns. Quantity/unit come from the natural-language parser.
CREATE TABLE IF NOT EXISTS pantry.items (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    raw_text        TEXT NOT NULL,            -- what the user said/typed
    name            TEXT NOT NULL,            -- display name, e.g. "Chicken Breast"
    normalized_name TEXT NOT NULL,            -- lowercase key for matching, e.g. "chicken"
    quantity        NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit            TEXT NOT NULL DEFAULT 'unit',
    category        TEXT NOT NULL DEFAULT 'other',
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ              -- NULL = no known shelf life
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_user ON pantry.items(user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_expires ON pantry.items(user_id, expires_at);
