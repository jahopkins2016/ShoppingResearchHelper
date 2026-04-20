# SaveIt — Project Brief

_For use as knowledge/instructions in a Claude.ai strategic project. Last updated: 2026-04-21._

---

## 1. Product Snapshot

**What it is:** SaveIt is a cross-platform product bookmarking app where users save items from any website into organized collections, synced across iOS, Android, web, and a Chrome/Edge extension.

**The problem it solves:** Shoppers researching across multiple sites have no single place to collect and compare products. Existing workarounds (browser wishlists, open tabs, screenshots, notes apps) don't automatically enrich metadata, track prices over time, or support collaboration. SaveIt captures a URL and immediately enriches it — title, image, price, brand, category, ratings, availability — and tracks price changes in the background.

**Who it's for:** Cross-site shoppers, gift planners (building wishlists to share), price watchers (waiting for drops), and collaborative shoppers (sharing collections with a partner or group).

**Current state:** Active prototype, ~75–80% MVP complete. The core loop works end-to-end: save a URL → metadata is enriched → item appears in a collection → collection can be shared. Not yet distributed (no App Store listing, no public user base). No monetization implemented.

---

## 2. Technical Architecture

**Stack:**
- **Mobile:** Flutter (iOS + Android). Active. A dormant React Native/Expo version also exists in the repo but is not being developed.
- **Web:** Next.js 15 App Router, deployed on Vercel. Domain: `saveit.website`.
- **Extension:** Chrome/Edge Manifest V3. Extension popup is functional; background service worker is minimal; content script is an empty stub.
- **Backend:** Supabase — Postgres + RLS, Auth (email/password + Google OAuth), Edge Functions (Deno), Storage, Realtime (not yet wired into any client).
- **CI/CD:** Codemagic for mobile builds.

**Key architectural decisions:**
- Supabase is the single source of truth; there is no custom API layer. All business logic lives in Edge Functions (Deno) or Postgres RLS policies and triggers.
- Price is stored as `text` everywhere, intentionally. Avoids currency normalization complexity but limits price math, sorting, and comparison logic.
- Metadata extraction is duplicated: the browser extension does it client-side (page DOM access), the `enrich-item` Edge Function does it server-side (for mobile + web). These can drift.

**What's built vs. stubbed:**
- Built: Flutter app, web app, extension popup, 15-table schema with 14 migrations, 3 production Edge Functions (`enrich-item`, `schedule-rechecks`, `send-invite-email`).
- Partial: `enrich-item-from-photos` (vision enrichment for in-store items — Claude API integration set up, response handling incomplete), `reverse-geocode` (Google Places API structure exists, parsing incomplete).
- Not wired: Supabase Realtime (schema supports it; zero client subscriptions implemented in either app or web).

---

## 3. Feature Inventory

**Shipped — working end-to-end:**
- Auth: email/password + Google OAuth, password reset, profile auto-created on signup with referral code
- Collections: create, archive, pin, sort, share via email invite (viewer/editor roles) or public invite link
- URL item saving: paste/share a URL → `enrich-item` Edge Function extracts title, image, price, brand, category, ratings, availability, similar products, caches image to Supabase Storage
- Price history: tracked on every enrich run; `lowest_price` maintained; `schedule-rechecks` Edge Function re-checks all non-archived items every 24 hours
- iOS native share extension: captures URLs from any iOS app, unwraps Google redirect URLs, hands off to host app via app group
- Email invites: `send-invite-email` Edge Function renders HTML email and sends via SMTP
- Friends: auto-created bidirectionally when a collection share invite is accepted (DB trigger); friends list displayed in both apps
- In-app messaging: conversations, messages, read/unread tracking, participant list; Realtime subscriptions not wired (no live updates)
- Referral system: auto-assigned referral code per user; invite links; referral tracked on signup via cookie
- Feedback form with history
- Settings: theme (dark/light/system), referral sharing, sign out

**In progress — partially built:**
- In-store item capture: Flutter UI complete (photo picker, GPS, reverse-geocode stub, form entry); vision enrichment Edge Function exists but response handling is incomplete
- Item comparisons: list view and creation work; detail/side-by-side comparison logic not wired
- Browser extension: save flow functional; content script empty (no page DOM injection, no context menu, no notifications)
- Public collection view: route `/public/c/[id]` exists in web; page renders nothing
- Reverse-geocode for nearby stores: Edge Function skeleton exists, Google Places API parsing incomplete

**Planned/stubbed — UI exists, no backend:**
- Notification preferences (local state only, not persisted to DB)
- Privacy settings / account deletion (comment in code: "requires server-side call — not implemented")
- Tags system (mentioned in schema spec, table not yet created)
- Edit/delete UI for collections and items (known gap; users can create but not easily reorganize)
- Realtime subscriptions for live messaging and collection updates
- Price drop push notifications

---

## 4. Data Model Summary

**Core entities and relationships:**
- `profiles` — extends auth.users; has `display_name`, `avatar_url`, `referral_code`
- `collections` — owned by one user; has `archived_at` (soft delete), `is_pinned`, `invite_token` (UUID for public link sharing)
- `items` — belongs to a collection; nullable `url` (in-store items have no URL); stores enriched metadata (title, image, price, brand, category, rating, seller, SKU, GTIN, color, size, availability, condition, shipping, return_policy); has `source` enum (`url` | `in_store`)
- `price_history` — append-only log per item; `checked_at` timestamp
- `collection_shares` — email-based sharing with `role` (viewer/editor), `status` (pending/accepted/declined), `invite_token`
- `friends` — bidirectional; `source` column tracks how the friendship was established
- `conversations` / `conversation_participants` / `messages` — standard messaging schema; `read_at` on messages
- `referrals` — tracks `referrer_id`, `referred_email`, `status` (pending/signed_up)
- `item_comparisons` / `comparison_items` — for side-by-side product comparisons
- `feedback`, `pinned_collections`, `similar_products` — supporting tables

**Flags worth knowing:**
- Price is `text`, never numeric. Intentional. Limits sorting, math, and analytics.
- RLS is comprehensive on all tables. All business logic additions need RLS consideration.
- Two mobile codebases in the repo: `mobile_flutter/` (active) and `mobile/` (React Native, dormant). No explicit decision recorded to sunset the latter.

---

## 5. Open Questions & Tensions

1. **Two mobile codebases.** Flutter is clearly the active path (CI/CD, share extension, recent commits), but the React Native version hasn't been explicitly closed out. Carries cognitive overhead and docs confusion.

2. **Auth storage security gap.** Mobile currently stores auth tokens in AsyncStorage (cleartext). Needs migration to SecureStore before the iOS share extension can safely launch — this is a documented known gap that blocks distribution.

3. **Price-as-text limits future features.** Comparison sorting, price drop alerts with thresholds, and analytics all require numeric price values. The current design kicks this problem forward.

4. **Referral attribution is incomplete.** The `referrals` table has a `pending`/`signed_up` status, but there's no DB trigger to flip `pending → signed_up` when someone actually creates an account. Manual or API-driven conversion not yet implemented.

5. **Friends are implicit, not requested.** Friendships auto-create from collection share acceptance. There's no explicit add/request/accept flow. This is a product decision with implications for trust, privacy, and future social features.

6. **Metadata extraction duplication.** Extension extracts metadata client-side; `enrich-item` extracts server-side. Same logic in two places with no shared source of truth. Divergence risk as either evolves.

7. **No edit/delete UI.** Users can create items and collections but can't easily rename, reorder, or delete them. This is a known gap that will hurt retention once users accumulate data.

---

## 6. Business Context

**Monetization:** None implemented. No Stripe, no subscription tiers, no paywalls, no usage limits, no affiliate links.

**Growth mechanic:** A referral system exists (invite codes, link tracking, signup attribution) but is not yet fully wired end-to-end.

**Likely monetization path** (inferred from features, not stated): Price alert notifications and priority re-enrichment are natural premium hooks given the price history infrastructure already built.

**Target user** (inferred from features and landing page copy): Shoppers who research products across multiple sites; gift planners; people who share wishlists with partners or groups. Landing page tagline: _"Curate your personal gallery of inspiration. Bookmark products from any site."_

**Competitors:** None mentioned anywhere in the codebase, docs, or comments.

**Distribution plan:** iOS App Store + Google Play Store (mobile); Chrome Web Store (extension); Vercel (web). Domain `saveit.website` purchased and hardcoded throughout. App Store submission not yet initiated.
