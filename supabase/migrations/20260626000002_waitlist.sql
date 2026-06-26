CREATE TABLE IF NOT EXISTS public.waitlist (
    id         BIGSERIAL PRIMARY KEY,
    email      TEXT NOT NULL,
    source     TEXT DEFAULT 'web',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT waitlist_email_unique UNIQUE (email)
);
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join waitlist"
    ON public.waitlist FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);
GRANT INSERT ON public.waitlist TO anon, authenticated;
GRANT ALL    ON public.waitlist TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.waitlist_id_seq TO anon, authenticated;
