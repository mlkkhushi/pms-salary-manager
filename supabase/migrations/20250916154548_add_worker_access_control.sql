-- Step 1: Add the is_accessible column to the workers table.
-- This column will control which worker's data is visible in reports.
-- It defaults to 'false', meaning access must be explicitly granted.
ALTER TABLE public.workers
ADD COLUMN is_accessible BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Create a function to automatically grant access to the first worker a user creates.
-- This ensures every user can see at least one worker's report by default.
CREATE OR REPLACE FUNCTION public.grant_access_to_first_worker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user inserting the worker already has any other accessible workers.
  IF NOT EXISTS (
    SELECT 1
    FROM public.workers
    WHERE user_id = NEW.user_id AND is_accessible = true
  ) THEN
    -- If they don't have any accessible workers, this is their first one.
    -- So, we make this new worker accessible automatically.
    NEW.is_accessible := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 3: Create a trigger that calls the function before a new worker is inserted.
-- We drop it first to make this script re-runnable in case of issues.
DROP TRIGGER IF EXISTS on_worker_created_grant_first_access ON public.workers;
CREATE TRIGGER on_worker_created_grant_first_access
  BEFORE INSERT ON public.workers
  FOR EACH ROW EXECUTE PROCEDURE public.grant_access_to_first_worker();

-- Step 4: Enable Row Level Security on all relevant tables.
-- It's safe to run these commands even if RLS is already enabled.
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_earnings ENABLE ROW LEVEL SECURITY;

-- Step 5: Define the RLS policies.

-- Policy for 'workers' table:
-- Allow users full control (SELECT, INSERT, UPDATE, DELETE) over all of their own workers.
DROP POLICY IF EXISTS "Allow full access to own workers" ON public.workers;
CREATE POLICY "Allow full access to own workers"
ON public.workers FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for 'daily_entries' table:
-- Allow users full control over their own daily entries.
DROP POLICY IF EXISTS "Allow full access to own daily entries" ON public.daily_entries;
CREATE POLICY "Allow full access to own daily entries"
ON public.daily_entries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies for 'daily_earnings' table:
-- This is where we enforce the specific access control for reports.

-- CORRECTED SECTION: We now have separate policies for each write action.
DROP POLICY IF EXISTS "Allow insert access to own earnings" ON public.daily_earnings;
CREATE POLICY "Allow insert access to own earnings"
ON public.daily_earnings FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow update access to own earnings" ON public.daily_earnings;
CREATE POLICY "Allow update access to own earnings"
ON public.daily_earnings FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow delete access to own earnings" ON public.daily_earnings;
CREATE POLICY "Allow delete access to own earnings"
ON public.daily_earnings FOR DELETE
USING (auth.uid() = user_id);

-- Policy for READ access: This is the core of our new security feature.
-- It only allows reading earnings data for "accessible" workers.
DROP POLICY IF EXISTS "Allow read access to accessible worker earnings" ON public.daily_earnings;
CREATE POLICY "Allow read access to accessible worker earnings"
ON public.daily_earnings FOR SELECT
USING (
  auth.uid() = user_id AND
  worker_name IN (
    SELECT worker_name FROM public.workers WHERE user_id = auth.uid() AND is_accessible = true
  )
);