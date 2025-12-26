-- 1. Column add karein
ALTER TABLE public.daily_earnings 
ADD COLUMN IF NOT EXISTS entry_date DATE;

-- 2. Purana data jo maujood hai, uski dates update karein
UPDATE public.daily_earnings 
SET entry_date = daily_entries.entry_date
FROM public.daily_entries
WHERE daily_earnings.entry_id = daily_entries.id;

-- 3. Column ko NOT NULL karein (sirf tab jab purana data update ho jaye)
ALTER TABLE public.daily_earnings 
ALTER COLUMN entry_date SET NOT NULL;

-- 4. Index banayein taake report tez load ho
CREATE INDEX IF NOT EXISTS idx_earnings_entry_date ON public.daily_earnings(entry_date);