-- Google Calendar secure account linking + token storage hardening

CREATE TABLE IF NOT EXISTS public.google_connections (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  google_email text,
  access_token text,
  refresh_token text,
  token_type text,
  scope text,
  expiry_date timestamptz,
  oauth_state text,
  oauth_state_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS google_email text,
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS token_type text,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS expiry_date timestamptz,
  ADD COLUMN IF NOT EXISTS oauth_state text,
  ADD COLUMN IF NOT EXISTS oauth_state_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.google_connections
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE public.google_connections
SET
  status = COALESCE(status, 'pending'),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now())
WHERE
  status IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.google_connections
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.google_connections
  DROP CONSTRAINT IF EXISTS google_connections_status_check;

ALTER TABLE public.google_connections
  ADD CONSTRAINT google_connections_status_check
  CHECK (status IN ('pending', 'connected', 'error'));

CREATE UNIQUE INDEX IF NOT EXISTS google_connections_user_id_uidx
ON public.google_connections (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS google_connections_oauth_state_uidx
ON public.google_connections (oauth_state)
WHERE oauth_state IS NOT NULL;

CREATE INDEX IF NOT EXISTS google_connections_status_idx
ON public.google_connections (status);

CREATE OR REPLACE FUNCTION public.google_connections_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_google_connections_updated_at ON public.google_connections;

CREATE TRIGGER set_google_connections_updated_at
BEFORE UPDATE ON public.google_connections
FOR EACH ROW
EXECUTE FUNCTION public.google_connections_set_updated_at();

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'google_connections'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.google_connections', p.policyname);
  END LOOP;
END
$$;

CREATE POLICY google_connections_select_own
ON public.google_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

REVOKE ALL ON public.google_connections FROM anon;
REVOKE ALL ON public.google_connections FROM authenticated;

GRANT SELECT (user_id, status, google_email, expiry_date, created_at, updated_at)
ON public.google_connections
TO authenticated;

GRANT ALL ON public.google_connections TO service_role;
