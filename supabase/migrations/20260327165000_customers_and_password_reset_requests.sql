-- Create missing production tables used by the app:
-- - public.customers
-- - public.password_reset_requests
-- Includes minimal role-based RLS compatible with existing app behavior.

CREATE TABLE IF NOT EXISTS public.customers (
  id bigserial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Active', 'Inactive')),
  visits integer NOT NULL DEFAULT 0 CHECK (visits >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_status_idx ON public.customers(status);
CREATE INDEX IF NOT EXISTS customers_created_at_idx ON public.customers(created_at DESC);

CREATE OR REPLACE FUNCTION public.customers_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.customers_set_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', p.policyname);
  END LOOP;
END
$$;

CREATE POLICY customers_select_admin
ON public.customers
FOR SELECT
TO authenticated
USING (public.get_my_role() = 'admin');

CREATE POLICY customers_insert_admin
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY customers_update_admin
ON public.customers
FOR UPDATE
TO authenticated
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY customers_delete_admin
ON public.customers
FOR DELETE
TO authenticated
USING (public.get_my_role() = 'admin');


CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_requests_one_pending_per_user_idx
  ON public.password_reset_requests(user_id)
  WHERE status = 'pending' AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS password_reset_requests_status_idx
  ON public.password_reset_requests(status);

CREATE INDEX IF NOT EXISTS password_reset_requests_created_at_idx
  ON public.password_reset_requests(created_at DESC);

CREATE OR REPLACE FUNCTION public.password_reset_requests_set_resolved_meta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    NEW.resolved_at = COALESCE(NEW.resolved_at, now());
    NEW.resolved_by = COALESCE(NEW.resolved_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_password_reset_requests_resolved_meta ON public.password_reset_requests;
CREATE TRIGGER set_password_reset_requests_resolved_meta
BEFORE UPDATE ON public.password_reset_requests
FOR EACH ROW
EXECUTE FUNCTION public.password_reset_requests_set_resolved_meta();

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'password_reset_requests'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.password_reset_requests', p.policyname);
  END LOOP;
END
$$;

CREATE POLICY password_reset_requests_select_admin
ON public.password_reset_requests
FOR SELECT
TO authenticated
USING (public.get_my_role() = 'admin');

CREATE POLICY password_reset_requests_update_admin
ON public.password_reset_requests
FOR UPDATE
TO authenticated
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY password_reset_requests_delete_admin
ON public.password_reset_requests
FOR DELETE
TO authenticated
USING (public.get_my_role() = 'admin');
