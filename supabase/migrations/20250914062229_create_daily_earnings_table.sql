-- Create a type for attendance_status to ensure data consistency
create type public.attendance_status_type as enum ('Present', 'Absent');

-- Create the daily_earnings table
create table public.daily_earnings (
    id uuid primary key default gen_random_uuid(),
    
    -- Link to the specific daily entry
    entry_id uuid references public.daily_entries(id) on delete cascade not null,

    -- We also include user_id here for simpler RLS policies, though it's linked via entry_id
    user_id uuid references auth.users(id) on delete cascade not null,
    
    worker_name text not null,
    earning numeric not null check (earning >= 0),
    attendance_status public.attendance_status_type not null,

    created_at timestamptz default now()
);

-- Comments for clarity
comment on table public.daily_earnings is 'Stores the calculated earning for each worker for a specific daily entry.';
comment on column public.daily_earnings.entry_id is 'Links to the entry in the daily_entries table.';


-- RLS (Row Level Security) Policies
-- 1. Enable RLS on the table
alter table public.daily_earnings enable row level security;

-- 2. Allow users to manage their own earnings records
create policy "Users can manage their own daily earnings"
on public.daily_earnings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);