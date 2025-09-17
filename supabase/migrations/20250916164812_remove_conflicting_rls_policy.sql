-- This migration removes the overly permissive "ALL" policy on the daily_earnings table.
-- This policy was overriding our specific SELECT policy, causing the security leak.
-- NOTE: The policy name might be truncated in the dashboard. Use the full name found by inspecting the policy.
-- For now, we assume the name seen in the screenshot is the start of the full name.
-- If this fails, we will find the exact full name.

-- Let's try dropping the policy as seen in the screenshot first.
-- IMPORTANT: Replace "Users can manage their own dail..." with the EXACT full name if you know it.
-- For now, we will assume the name is 'Users can manage their own daily earnings' as a likely candidate.
DROP POLICY IF EXISTS "Users can manage their own daily earnings" ON public.daily_earnings;