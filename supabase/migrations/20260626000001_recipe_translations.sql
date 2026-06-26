-- Lazy translation cache for recipe instructions.
-- Only populated when a user actually requests a translation —
-- never pre-populated. Grows only with real usage.
CREATE TABLE IF NOT EXISTS recipe.translations (
    recipe_id    TEXT        NOT NULL REFERENCES recipe.recipes(id) ON DELETE CASCADE,
    lang         TEXT        NOT NULL,  -- BCP-47 code: 'hi', 'ta', 'bn', etc.
    instructions TEXT        NOT NULL,
    translated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (recipe_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_recipe_translations_lang ON recipe.translations (lang);

ALTER TABLE recipe.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Translations readable by all" ON recipe.translations FOR SELECT USING (true);
GRANT SELECT ON recipe.translations TO authenticated, anon;
GRANT ALL    ON recipe.translations TO service_role;
