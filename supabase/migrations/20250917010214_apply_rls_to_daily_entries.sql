-- This migration secures the 'daily_entries' table by replacing its
-- overly permissive 'ALL' policy with granular, secure policies,
-- matching the security model of the 'daily_earnings' table.

-- Step 1: Drop the old, insecure policy that allowed full access.
DROP POLICY IF EXISTS "Allow full access to own daily entries" ON public.daily_entries;

-- Step 2: Create new, specific policies for write access (INSERT, UPDATE, DELETE).
-- These are necessary for the daily entry page to function correctly.
CREATE POLICY "Allow insert access to own daily entries"
ON public.daily_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow update access to own daily entries"
ON public.daily_entries FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow delete access to own daily entries"
ON public.daily_entries FOR DELETE
USING (auth.uid() = user_id);

-- Step 3: Create the new, secure policy for READ (SELECT) access.
-- This is the core of the fix. It ensures that only entries linked to an
-- 'accessible' worker can be read by the application.
CREATE POLICY "Allow read access to accessible worker entries"
ON public.daily_entries FOR SELECT
USING (
  auth.uid() = user_id AND
  id IN (
    SELECT entry_id
    FROM public.daily_earnings
    WHERE worker_name IN (
      SELECT worker_name
      FROM public.workers
      WHERE user_id = auth.uid() AND is_accessible = true
    )
  )
);