-- ═══════════════════════════════════════════════════════════
-- FLARM GLOBAL — Supabase schema
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

-- ─── Tables ───
create table if not exists public.products (
  id         bigint generated always as identity primary key,
  name       text not null,
  category   text not null,
  "desc"     text default '',
  form       text default 'Herbal Capsules',
  img        text default '',
  available  boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id         bigint generated always as identity primary key,
  code       text unique not null,
  customer   jsonb not null,               -- {name, phone, address}
  items      jsonb not null,               -- [{id, name, qty}]
  status     text default 'Pending',
  via        text default 'Website',
  created_at timestamptz default now()
);

create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),   -- single row, id must be 1
  email      text default '',
  phone      text default '',
  whatsapp   text default '',
  location   text default '',
  hero_title text default '',
  hero_sub   text default ''
);

create table if not exists public.activity (
  id         bigint generated always as identity primary key,
  action     text not null,
  created_at timestamptz default now()
);

create table if not exists public.newsletter_subscribers (
  id         bigint generated always as identity primary key,
  email      text not null,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  name       text default '',
  phone      text default '',
  email      text default '',
  body       text default '',
  created_at timestamptz default now()
);

-- default settings row
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- index for fast order tracking
create index if not exists orders_code_idx on public.orders (code);

-- ─── Row Level Security ───
alter table public.products               enable row level security;
alter table public.orders                 enable row level security;
alter table public.settings               enable row level security;
alter table public.activity               enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.messages               enable row level security;

-- products: everyone can read, only logged-in admin can change
drop policy if exists "Public read products" on public.products;
create policy "Public read products" on public.products for select using (true);
drop policy if exists "Admin manage products" on public.products;
create policy "Admin manage products" on public.products for all to authenticated using (true) with check (true);

-- orders: anyone can PLACE an order, only admin can read/update/delete them
drop policy if exists "Anyone can place an order" on public.orders;
create policy "Anyone can place an order" on public.orders for insert to anon, authenticated with check (true);
drop policy if exists "Admin select orders" on public.orders;
create policy "Admin select orders" on public.orders for select to authenticated using (true);
drop policy if exists "Admin update orders" on public.orders;
create policy "Admin update orders" on public.orders for update to authenticated using (true);
drop policy if exists "Admin delete orders" on public.orders;
create policy "Admin delete orders" on public.orders for delete to authenticated using (true);

-- settings: everyone can read, only admin can change
drop policy if exists "Public read settings" on public.settings;
create policy "Public read settings" on public.settings for select using (true);
drop policy if exists "Admin upsert settings" on public.settings;
create policy "Admin upsert settings" on public.settings for insert to authenticated with check (true);
drop policy if exists "Admin update settings" on public.settings;
create policy "Admin update settings" on public.settings for update to authenticated using (true);

-- activity: site can log events, only admin reads them
drop policy if exists "Anyone logs activity" on public.activity;
create policy "Anyone logs activity" on public.activity for insert to anon, authenticated with check (true);
drop policy if exists "Admin read activity" on public.activity;
create policy "Admin read activity" on public.activity for select to authenticated using (true);

-- newsletter + contact messages: anyone can submit, only admin reads
drop policy if exists "Anyone subscribes" on public.newsletter_subscribers;
create policy "Anyone subscribes" on public.newsletter_subscribers for insert to anon, authenticated with check (true);
drop policy if exists "Admin read subscribers" on public.newsletter_subscribers;
create policy "Admin read subscribers" on public.newsletter_subscribers for select to authenticated using (true);

drop policy if exists "Anyone sends message" on public.messages;
create policy "Anyone sends message" on public.messages for insert to anon, authenticated with check (true);
drop policy if exists "Admin read messages" on public.messages;
create policy "Admin read messages" on public.messages for select to authenticated using (true);

-- ─── Safe order tracking for customers (no exposing everyone's orders) ───
create or replace function public.track_order(p_code text, p_phone text)
returns setof public.orders
language sql
security definer
set search_path = public
as $$
  select * from public.orders
  where upper(code) = upper(trim(p_code))
    and right(regexp_replace(customer->>'phone', '\D', '', 'g'), 10)
      = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
  order by created_at desc
  limit 1;
$$;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- ─── Product image storage bucket ───
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "Admin upload product images" on storage.objects;
create policy "Admin upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
drop policy if exists "Admin update product images" on storage.objects;
create policy "Admin update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images');
drop policy if exists "Admin delete product images" on storage.objects;
create policy "Admin delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images');

-- ─── Realtime (live sync between admin and storefront) ───
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.orders;
