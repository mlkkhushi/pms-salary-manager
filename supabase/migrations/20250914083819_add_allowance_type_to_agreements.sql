-- Create a new type for the allowance calculation method
create type public.allowance_calculation_method as enum ('Normal', 'Pro-Rata');

-- Add the new column to the agreements table
alter table public.agreements
add column allowance_calculation_type public.allowance_calculation_method not null default 'Normal';

-- Add a comment to explain the new column
comment on column public.agreements.allowance_calculation_type is 'The method to calculate allowance: Normal (half monthly) or Pro-Rata (daily basis for non-standard periods).';