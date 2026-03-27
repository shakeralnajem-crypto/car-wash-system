-- Orders ownership + role-based RLS
-- Production-safe baseline:
-- - Uses assigned_employee_id (uuid) as the security owner key
-- - Keeps display-name backfill strictly defensive (unique-name matches only)
-- - Enforces: admin full, manager orders-only (no delete), employee own rows only

-- Keep role lookup available for policies.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
$$;

-- Stable ownership column for orders.
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS assigned_employee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_assigned_employee_id_idx
ON public.orders (assigned_employee_id);

-- Defensive one-time backfill:
-- Only fill when the display name maps to exactly one profile row.
WITH unique_profiles AS (
  SELECT display_name, (array_agg(id ORDER BY id))[1] AS id
  FROM public.profiles
  WHERE display_name IS NOT NULL
    AND btrim(display_name) <> ''
  GROUP BY display_name
  HAVING COUNT(*) = 1
)
UPDATE public.orders AS o
SET assigned_employee_id = up.id
FROM unique_profiles AS up
WHERE o.assigned_employee_id IS NULL
  AND btrim(COALESCE(o.employee, '')) = up.display_name;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Remove existing orders policies to avoid permissive leftovers.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', p.policyname);
  END LOOP;
END
$$;

CREATE POLICY orders_select_policy
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.get_my_role() IN ('admin', 'manager')
  OR (
    public.get_my_role() = 'employee'
    AND assigned_employee_id = auth.uid()
  )
);

CREATE POLICY orders_insert_policy
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.get_my_role() IN ('admin', 'manager')
    AND assigned_employee_id IS NOT NULL
  )
  OR (
    public.get_my_role() = 'employee'
    AND assigned_employee_id = auth.uid()
  )
);

CREATE POLICY orders_update_policy
ON public.orders
FOR UPDATE
TO authenticated
USING (public.get_my_role() IN ('admin', 'manager'))
WITH CHECK (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY orders_delete_policy
ON public.orders
FOR DELETE
TO authenticated
USING (public.get_my_role() = 'admin');
