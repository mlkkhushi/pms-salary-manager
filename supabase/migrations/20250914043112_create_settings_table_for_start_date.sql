-- Create the settings table
create table public.settings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null unique,
    
    -- Field for the agreement start date
    agreement_start_date date,

    created_at timestamptz default now() -- YAHAN GHALTI THEEK KAR DI GAYI HAI
);

-- Comments describing the purpose of the table
comment on table public.settings is 'Stores general, one-off settings for each user.';
comment on column public.settings.agreement_start_date is 'The start date for the user''s primary agreement.';


-- RLS (Row Level Security) Policies
-- 1. Enable RLS on the table
alter table public.settings enable row level security;

-- 2. Allow users to see their own settings
create policy "Users can view their own settings"
on public.settings for select
using (auth.uid() = user_id);

-- 3. Allow users to create their own settings
create policy "Users can create their own settings"
on public.settings for insert
with check (auth.uid() = user_id);

-- 4. Allow users to update their own settings
create policy "Users can update their own settings"
on public.settings for update
using (auth.uid() = user_id);