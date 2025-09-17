-- Add a 'wagons' column to the 'daily_entries' table to store the number of wagons for a given day.
-- This is crucial for calculating wagon-based earnings and their arrears.
-- Defaulting to 0 ensures that existing entries without wagon data remain valid.
ALTER TABLE public.daily_entries
ADD COLUMN wagons NUMERIC DEFAULT 0;