-- Add a new column to the profiles table to store an array of allowed worker names.
-- This allows app creators to control which workers' data a specific user can see.
ALTER TABLE public.profiles
ADD COLUMN allowed_workers TEXT[] NULL;

-- Enable Row-Level Security on the profiles table if it's not already enabled.
-- This is a security best practice.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create a policy to ensure users can only view their own profile.
-- This prevents users from seeing each other's settings or allowed worker lists.
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Create a policy to allow users to update their own profile.
-- This is necessary for the existing profile page functionality to work.
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);