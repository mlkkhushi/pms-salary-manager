-- Add columns for the penalty system to the existing settings table

ALTER TABLE public.settings
ADD COLUMN is_penalty_system_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN penalty_amount NUMERIC NOT NULL DEFAULT 231;

-- Add comments to the new columns for better understanding

COMMENT ON COLUMN public.settings.is_penalty_system_enabled IS 'This toggle enables or disables the penalty system.';
COMMENT ON COLUMN public.settings.penalty_amount IS 'This is the penalty amount for each red-flagged absent worker.';