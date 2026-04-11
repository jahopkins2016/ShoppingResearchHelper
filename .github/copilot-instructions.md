# SaveIt — Project Instructions

## What This Project Is
SaveIt is a cross-platform product bookmarking app. Users save items from any website into organized collections, synced across mobile and desktop. Key features: price tracking over time with drop alerts, iOS share extension, Chrome/Edge browser extension, collection sharing with collaborator roles, friends/messaging, item comparisons, and a referral system.

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

## Database Tables

| Table | Key columns |
|-------|-------------|
| `profiles` | `id` (=auth.users.id), `display_name`, `avatar_url`, `email`, `referral_code` |
| `collections` | `user_id`, `name`, `is_public`, `share_token`, `description`, `is_default` |
| `items` | `user_id`, `collection_id`, `url`, `price`, `currency`, `lowest_price`, `price_drop_seen`, `enrichment_status`, `brand`, `category`, `availability`, `condition`, `rating`, `sale_price`, `original_price`, `product_metadata` (JSONB) |
| `price_history` | `item_id`, `price`, `currency`, `checked_at` |
| `collection_shares` | `collection_id`, `shared_by`, `shared_with_email`, `role` (viewer/editor), `status` |
| `referrals` | `referrer_id`, `referred_email`, `referred_user_id`, `status` (pending/signed_up) |
| `similar_products` | `item_id`, `title`, `url`, `image_url`, `price`, `currency`, `site_name`, `similarity_source` |
| `pinned_collections` | `user_id`, `collection_id`, `sort_order` |
| `feedback` | `user_id`, `category`, `message`, `status` |
| `friends` | `user_id`, `friend_user_id` |
| `conversations` | `id`, `last_message`, `updated_at` |
| `conversation_participants` | `conversation_id`, `user_id` |
| `messages` | `conversation_id`, `sender_id`, `body`, `is_read` |
| `item_comparisons` | `user_id`, `name` |
| `comparison_items` | `comparison_id`, `item_id`, `sort_order` |

All tables have Row Level Security enabled. Every new table must have RLS policies.

## Key Patterns

**Enrichment flow:** Items are inserted with `enrichment_status: 'pending'`, then the `enrich-item` Edge Function is invoked (fire-and-forget). It fetches the URL, extracts OG tags + JSON-LD + price heuristics (20+ fields), caches images to Supabase Storage, finds similar products, updates the item, writes a `price_history` row, and sets `enrichment_status: 'completed'`. If new price < `lowest_price`, also set `price_drop_seen = false`.

**Schedule rechecks:** The `schedule-rechecks` Edge Function finds items not checked in 24+ hours and re-invokes `enrich-item` in batches. Triggered via `web/app/api/cron/rechecks/` endpoint with `CRON_SECRET` auth.

**Auth storage — mobile:** Currently uses AsyncStorage. Should migrate to `expo-secure-store` with `keychainAccessGroup: "group.com.saveit.app"` before implementing the iOS share extension.

**Web Supabase clients:** Server components and API routes use `web/lib/supabase/server.ts` (cookie-based SSR client). Client components use `web/lib/supabase/client.ts`. Never use the server client in a client component.

**Extension enrichment:** The popup extracts metadata inline via `chrome.scripting.executeScript` and inserts items with `enrichment_status: 'completed'` directly (no Edge Function call needed — it has page access).

**Collection sharing:** Email-based invites via `send-invite-email` Edge Function (SMTP). Join page handles `?share_id=` param. Pending invitations shown on web shared page with accept/decline.

**Friends & messaging:** Friends are synced from `collection_shares` (bidirectional). Conversations support real-time messaging with unread tracking.

## What's Currently Implemented

**Backend (Supabase) — ~95% complete:**
- All 15 tables with RLS policies
- `enrich-item` Edge Function — full metadata extraction, price history, image caching, similar products
- `schedule-rechecks` Edge Function — 24-hour stale threshold, batch processing
- `send-invite-email` Edge Function — SMTP email with invite link
- Shared utilities: metadata-extractor.ts (JSON-LD, OG, heuristics), similar-products.ts (multi-source), types.ts

**Browser Extension — MVP complete:**
- Login (email/password + Google OAuth), metadata extraction, collection picker, save item flow
- Background service worker and content script are stubs (not needed for current flow)

**Web (Next.js) — ~90% complete:**
- Auth (email/password + Google OAuth + middleware session refresh)
- Collections (list, create, pin/reorder, public toggle, email sharing with roles)
- Items (display with rich metadata, add via URL, price history timeline, price drop badges)
- Public collections (browse + read-only detail)
- Shared collections with pending invitation accept/decline
- Friends, messages (full real-time chat), compare (full CRUD + side-by-side), feedback, settings
- Referral system (code generation, join page, tracking)
- Get Extension marketing page + cron endpoint for rechecks

**Mobile (React Native/Expo) — ~70% complete:**
- Auth (email/password + Google OAuth)
- Collections (list, create, view items), items (list, add via URL, view metadata, open URL)
- Price drop badges + price history sheet, similar products display, nearby stores links
- Shared collections, friends, messages/conversations, compare, feedback, settings with referral sharing

## Known Gaps (not yet implemented)

| Gap | Surfaces |
|-----|----------|
| Collection edit (rename/description) and delete UI | Web, Mobile |
| Item edit and delete UI | Web, Mobile |
| Mobile pending invitation accept/decline | Mobile |
| Compare add/remove/delete items | Mobile |
| Settings sub-pages (notifications, appearance, privacy, storage, help) | Mobile |
| Secure token storage (`expo-secure-store` instead of AsyncStorage) | Mobile |
| iOS share extension | Mobile (needs Apple Developer account) |
| Push notifications for price drops | Mobile |
| Offline queue | Mobile |
| Referral auto-conversion DB trigger (pending → signed_up on signup) | Backend |
| `tags` table | Backend (listed as future) |
| Nearby stores full integration | Web (stub) |
| Extension context menu ("Save with SaveIt") | Extension |
| SMTP env vars for `send-invite-email` | Backend config |

## Conventions
- Mobile screens use `StyleSheet.create` (no styled-components, no NativeWind yet)
- Web uses CSS Modules (`*.module.css`) per page/layout — no Tailwind
- No ORM — all DB access via `supabase-js` client directly
- Deno Edge Functions: use `import { serve } from "https://deno.land/std/http/server.ts"` pattern; auth via `Authorization: Bearer <service_role_key>` header
- Price is stored as `text` — no numeric conversion or currency normalization
- Never add `applyTo: "**"` to instruction files
