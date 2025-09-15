-- Create a type for day_type to ensure data consistency
create type public.day_of_week_type as enum ('Work Day', 'Rest Day');

-- Create the daily_entries table
create table public.daily_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    
    entry_date date not null,
    day_type public.day_of_week_type not null,
    tonnage numeric, -- Can be null for rest days

    created_at timestamptz default now(),

    -- Make sure a user cannot have two entries for the same date
    constraint daily_entries_user_id_entry_date_key unique (user_id, entry_date)
);

-- Comments for clarity
comment on table public.daily_entries is 'Stores the main entry for each day''s activity for a user.';
comment on column public.daily_entries.tonnage is 'Tonnage for the day. Null if it''s a Rest Day.';


-- RLS (Row Level Security) Policies
-- 1. Enable RLS on the table
alter table public.daily_entries enable row level security;

-- 2. Allow users to manage their own entries (select, insert, update, delete)
create policy "Users can manage their own daily entries"
on public.daily_entries for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);