-- ROLLING BACK ALL CHANGES RELATED TO WORKER ACCESS CONTROL

-- Step 1: Revert changes on 'daily_entries' table
-- Drop the granular policies we added.
DROP POLICY IF EXISTS "Allow insert access to own daily entries" ON public.daily_entries;
DROP POLICY IF EXISTS "Allow update access to own daily entries" ON public.daily_entries;
DROP POLICY IF EXISTS "Allow delete access to own daily entries" ON public.daily_entries;
DROP POLICY IF EXISTS "Allow read access to accessible worker entries" ON public.daily_entries;

-- Restore the original, permissive policy for 'daily_entries'.
CREATE POLICY "Allow full access to own daily entries"
ON public.daily_entries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- Step 2: Revert changes on 'daily_earnings' table
-- Drop the granular policies we added.
DROP POLICY IF EXISTS "Allow insert access to own earnings" ON public.daily_earnings;
DROP POLICY IF EXISTS "Allow update access to own earnings" ON public.daily_earnings;
DROP POLICY IF EXISTS "Allow delete access to own earnings" ON public.daily_earnings;
DROP POLICY IF EXISTS "Allow read access to accessible worker earnings" ON public.daily_earnings;

-- Restore the original, permissive policy that we deleted.
-- The name might have been "Users can manage their own daily earnings" or similar.
-- We will create a generic one that provides the same full access.
DROP POLICY IF EXISTS "Users can manage their own daily earnings" ON public.daily_earnings; -- Drop just in case it exists with a different definition
CREATE POLICY "Users can manage their own daily earnings"
ON public.daily_earnings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- Step 3: Revert changes to the 'workers' table structure and logic.
-- Drop the trigger that set the 'is_accessible' flag.
DROP TRIGGER IF EXISTS on_worker_created_grant_first_access ON public.workers;

-- Drop the function that the trigger used.
DROP FUNCTION IF EXISTS public.grant_access_to_first_worker();

-- Drop the 'is_accessible' column from the workers table.
ALTER TABLE public.workers
DROP COLUMN IF EXISTS is_accessible;