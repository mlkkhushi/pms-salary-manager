-- Add the new column for the wagon rate system to the settings table
alter table public.settings
add column is_wagon_system_enabled boolean not null default false;

-- Add a comment to explain the new column
comment on column public.settings.is_wagon_system_enabled is 'If true, the wagon rate calculation is active.';