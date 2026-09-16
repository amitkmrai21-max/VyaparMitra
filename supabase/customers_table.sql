-- Customer Manager: run this once in the Supabase SQL editor.
-- Mirrors the existing businesses/campaigns tables (owner_id scoped, RLS enabled).

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  phone text not null,
  reminder_type text not null default 'general'
    check (reminder_type in ('general', 'appointment', 'payment')),
  follow_up_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists customers_business_id_idx on public.customers (business_id);
create index if not exists customers_follow_up_date_idx on public.customers (follow_up_date);

alter table public.customers enable row level security;

create policy "Owners can manage their own customers"
  on public.customers
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
