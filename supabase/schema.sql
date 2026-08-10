-- Studio Kath admin — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query)
-- on a fresh project, before pointing kath-admin at it.
--
-- Access model: kath-admin is a private, single-admin backend that already
-- gates every page behind its own login (see src/middleware.ts). All reads
-- and writes happen server-side using the Supabase *service role* key,
-- which bypasses Row Level Security entirely — so RLS is left off here on
-- purpose rather than modeled with policies that would just be redundant.
-- If the public storefront (kath) is later wired to read this data
-- directly from the browser, revisit this and add read-only RLS policies
-- scoped to the anon key instead of exposing the service role key there.

create table if not exists products (
	id text primary key,
	name text not null,
	price integer not null,
	stock integer not null default 0,
	image text not null default '',
	details text not null default '',
	sold_out boolean not null default false,
	created_at timestamptz not null default now()
);

create table if not exists orders (
	order_id text primary key,
	items jsonb not null default '[]'::jsonb,
	total integer not null default 0,
	contact jsonb not null default '{}'::jsonb,
	status text not null default 'pending',
	read boolean not null default false,
	created_at timestamptz not null default now()
);

-- Key/value store for non-product site copy (currently just the Home page
-- hero) — kept generic so new sections don't need a schema migration.
create table if not exists site_content (
	key text primary key,
	value jsonb not null default '{}'::jsonb
);

insert into site_content (key, value)
values (
	'home',
	'{
		"heroHeadline": "Cut by hand.\nMade in small batches.",
		"heroSubtext": "Every piece starts as a length of cloth and a chalk line, not a production run. We cut what we can make well, and no more.",
		"heroImages": []
	}'::jsonb
)
on conflict (key) do nothing;

-- Storage buckets for product/site images, replacing public/uploads/*.
-- Public read (so the storefront can eventually hot-link these URLs
-- directly) — writes only ever happen server-side via the service role key.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;
