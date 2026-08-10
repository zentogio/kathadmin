# Studio Kath — Admin (rough draft)

Companion back-office for the [Studio Kath storefront](../kath). Separate project, separate deploy — not a page inside the storefront.

## Run it

```bash
npm install
cp .env.example .env   # then edit ADMIN_USER / ADMIN_PASSWORD / SESSION_SECRET
npm run dev             # http://localhost:4322
```

Login with whatever you set `ADMIN_USER` / `ADMIN_PASSWORD` to in `.env`.

UI is in Thai.

## What's here

- **เข้าสู่ระบบ (Login)** — single admin account, credentials from `.env`, signed cookie session (no user table, no external auth service).
- **แดชบอร์ด (Dashboard)** — order/product counts, unread-order notice.
- **ออเดอร์ (Orders)** — list, change status, mark read. Unread orders show a dot + a badge count in the sidebar (the "notification system").
- **สินค้า (Products)** — full CRUD: add (name, price, stock, details, image upload), edit, delete, with a thumbnail list.
- **เนื้อหาหน้าเว็บ (Site Content)** — a first slice of "edit mode" for non-product content: Home page hero headline, subtext, and hero images. Narrow on purpose — not a general page builder.

## Data layer

Products, orders, and site content live in **Supabase** (Postgres + Storage) — see `supabase/schema.sql` for the tables/buckets to create in a fresh project, and `.env.example` for the `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` this app needs. All reads/writes happen server-side (`src/lib/store.ts`) using the service role key, which bypasses Row Level Security — fine since every page here is already gated behind the admin login.

Coming from the old local-JSON draft? `scripts/migrate-to-supabase.mjs` copies `data/*.json` and `public/uploads/*` into a fresh Supabase project once — run it after applying `supabase/schema.sql` and filling in `.env`.

## Known limitations (this is a draft)

- **Orders here are demo/seed data (until re-migrated).** The storefront's checkout currently only saves orders to the *customer's own browser* (localStorage) — nothing reaches this admin's Supabase project yet. Real orders won't show up here until the storefront is wired to write to the same Supabase project this app reads from.
- **Product/content changes don't reach the live storefront yet either.** This admin now writes to Supabase, but the storefront still reads its own copy of the catalog (`kath/src/data/products.ts`) and its own images (`kath/public/products/`), baked in at build time. The storefront needs to be wired to read from this same Supabase project before edits here actually change what customers see.
- **Session tokens aren't revocable.** Logging out clears the browser's cookie, but a copied token would still work until it expires (7 days) — there's no server-side session list. Fine for a single trusted admin; wouldn't be for a multi-user system.
- **Deploys to Vercel as serverless functions** (`output: 'server'`, `@astrojs/vercel` adapter) — not a static site, unlike the storefront. Remember to set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER`, `ADMIN_PASSWORD`, and `SESSION_SECRET` as environment variables in the Vercel project settings (Vercel doesn't read `.env`).
