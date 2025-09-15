-- Create the workers table
create table public.workers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    
    -- Field for the worker's name
    worker_name text check (char_length(worker_name) > 0),

    created_at timestamptz default now()
);

-- Comments describing the purpose of the table
comment on table public.workers is 'Stores the names of workers for each user.';
comment on column public.workers.worker_name is 'The name of a single worker.';


-- RLS (Row Level Security) Policies
-- 1. Enable RLS on the table
alter table public.workers enable row level security;

-- 2. Allow users to see their own workers
create policy "Users can view their own workers"
on public.workers for select
using (auth.uid() = user_id);

-- 3. Allow users to create workers for themselves
create policy "Users can create their own workers"
on public.workers for insert
with check (auth.uid() = user_id);

-- 4. Allow users to update their own workers
create policy "Users can update their own workers"
on public.workers for update
using (auth.uid() = user_id);

-- 5. Allow users to delete their own workers
create policy "Users can delete their own workers"
on public.workers for delete
using (auth.uid() = user_id);