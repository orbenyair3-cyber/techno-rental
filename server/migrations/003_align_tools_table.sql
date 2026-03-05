create extension if not exists pgcrypto;

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  name text,
  category text,
  price numeric default 0,
  deposit numeric default 0,
  max_days integer default 0,
  image_url text,
  description text,
  media_urls text[] default '{}'::text[],
  busydates jsonb default '[]'::jsonb,
  is_available boolean default true
);

alter table public.tools add column if not exists name text;
alter table public.tools add column if not exists category text;
alter table public.tools add column if not exists price numeric default 0;
alter table public.tools add column if not exists deposit numeric default 0;
alter table public.tools add column if not exists max_days integer default 0;
alter table public.tools add column if not exists image_url text;
alter table public.tools add column if not exists description text;
alter table public.tools add column if not exists media_urls text[] default '{}'::text[];
alter table public.tools add column if not exists busydates jsonb default '[]'::jsonb;
alter table public.tools add column if not exists is_available boolean default true;
