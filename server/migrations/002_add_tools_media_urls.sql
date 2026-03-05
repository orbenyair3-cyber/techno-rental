alter table public.tools
add column if not exists media_urls text[] default '{}'::text[];
