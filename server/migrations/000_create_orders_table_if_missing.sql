create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tool_id text,
  customer_name text,
  customer_email text,
  customer_phone text,
  start_date date,
  end_date date,
  status text default 'pending',
  created_at timestamp default now()
);