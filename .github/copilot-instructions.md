# SaveIt — Project Instructions

## What This Project Is
SaveIt is a cross-platform product bookmarking app. Users save items from any website into organized collections, synced across mobile and desktop. Key features: price tracking over time with drop alerts, iOS share extension, Chrome/Edge browser extension, collection sharing with collaborator roles, and a referral system.

## Surfaces & Tech Stack

| Surface | Tech | Root |
|---------|------|------|
| Mobile | React Native + Expo (expo-router) | `mobile/` |
| Web | Next.js 15 App Router | `web/` |
| Browser Extension | Chrome MV3 TypeScript | `extension/` |
| Backend | Supabase (Postgres + Edge Functions + Auth + Realtime + Storage) | `supabase/` |

## Supabase Project
- Local config: `supabase/config.toml` (project_id = ShoppingResearchHelper)
- Schema: `supabase/schema.sql` — run in Supabase SQL Editor to apply
- Edge Functions: `supabase/functions/` (Deno runtime)
- Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (mobile), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (web), service role key in Edge Function env only

## Core Database Tables

| Table | Key columns |
|-------|-------------|
| `profiles` | `id` (=auth.users.id), `display_name`, `avatar_url`, `email`, `referral_code` |
| `collections` | `user_id`, `name`, `is_public`, `share_token` |
| `items` | `user_id`, `collection_id`, `url`, `price`, `currency`, `lowest_price`, `price_drop_seen`, `enrichment_status` |
| `price_history` | `item_id`, `price`, `currency`, `checked_at` |
| `collection_shares` | `collection_id`, `shared_by`, `shared_with_email`, `role` (viewer/editor), `status` |
| `referrals` | `referrer_id`, `referred_email`, `referred_user_id`, `status` (pending/signed_up) |

All tables have Row Level Security enabled. Every new table must have RLS policies.

## Key Patterns

**Enrichment flow:** Items are inserted with `enrichment_status: 'pending'`, then the `enrich-item` Edge Function is invoked (fire-and-forget). It fetches the URL, extracts OG tags + JSON-LD + price heuristics, updates the item, writes a `price_history` row, and sets `enrichment_status: 'completed'`. If new price < `lowest_price`, also set `price_drop_seen = false`.

**Auth storage — mobile:** Use `expo-secure-store` with `keychainAccessGroup: "group.com.saveit.app"` (NOT AsyncStorage). Adapter is in `mobile/lib/secure-storage.ts`. This shared keychain group is required for the iOS share extension.

**Web Supabase clients:** Server components and API routes use `web/lib/supabase/server.ts` (cookie-based SSR client). Client components use `web/lib/supabase/client.ts`. Never use the server client in a client component.

**Extension enrichment:** The popup extracts metadata inline via `chrome.scripting.executeScript` and inserts items with `enrichment_status: 'completed'` directly (no Edge Function call needed — it has page access).

## What's Currently Implemented vs Planned

**Working:**
- Browser extension: full save flow (login, extract metadata, pick/create collection, insert item)
- Mobile: collections list, create collection, email/password auth
- Web: read-only collections + items display, email/password auth, middleware session refresh

**Planned (do not assume these exist):**
- `supabase/functions/enrich-item` — does NOT exist yet
- `supabase/functions/schedule-rechecks` — does NOT exist yet
- Mobile item list/detail screen — does NOT exist yet
- Mobile Google OAuth — does NOT exist yet
- Web add-item UI — does NOT exist yet
- `price_history` table — does NOT exist yet
- `referrals` table — does NOT exist yet
- iOS share extension — gated on Apple Developer account

## Conventions
- Mobile screens use `StyleSheet.create` (no styled-components, no NativeWind yet)
- Web uses CSS Modules (`*.module.css`) per page/layout — no Tailwind
- No ORM — all DB access via `supabase-js` client directly
- Deno Edge Functions: use `import { serve } from "https://deno.land/std/http/server.ts"` pattern; auth via `Authorization: Bearer <service_role_key>` header
- Price is stored as `text` — no numeric conversion or currency normalization
- Never add `applyTo: "**"` to instruction files
