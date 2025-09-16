-- Add the new columns for the penalty system to the settings table
alter table public.settings
add column is_penalty_system_enabled boolean not null default false,
add column penalty_amount numeric check (penalty_amount >= 0);

-- Add comments to explain the new columns
comment on column public.settings.is_penalty_system_enabled is 'If true, the penalty system for excess leaves is active.';
comment on column public.settings.penalty_amount is 'The penalty amount to be deducted from the present workers.';