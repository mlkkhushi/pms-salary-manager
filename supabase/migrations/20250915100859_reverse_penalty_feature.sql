alter table public.settings
drop column if exists is_penalty_system_enabled,
drop column if exists penalty_amount;