-- Create the agreements table
create table public.agreements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    
    -- To distinguish between 'current' and 'new' agreements
    agreement_name text not null, 

    ton_rate numeric default 0,
    rest_rate numeric default 0,
    layoff_rate numeric default 0,
    wagon_rate numeric default 0,
    monthly_allowance numeric default 0,
    without_paid_leaves integer default 0,
    paid_leaves integer default 0,
    paid_leave_rate numeric default 0,
    
    created_at timestamptz default now(),

    -- Make sure a user can only have one 'current' and one 'new' agreement
    constraint agreements_user_id_agreement_name_key unique (user_id, agreement_name)
);

-- RLS (Row Level Security) Policies
-- 1. Enable RLS on the table
alter table public.agreements enable row level security;

-- 2. Allow users to see their own agreements
create policy "Users can view their own agreements"
on public.agreements for select
using (auth.uid() = user_id);

-- 3. Allow users to create their own agreements
create policy "Users can create their own agreements"
on public.agreements for insert
with check (auth.uid() = user_id);

-- 4. Allow users to update their own agreements
create policy "Users can update their own agreements"
on public.agreements for update
using (auth.uid() = user_id);