# SaveIt - Project Context

## Product Overview
**SaveIt** is a cross-platform product bookmarking app. Users save items from any website into organized collections, synced across mobile and desktop.

**Key features:**
- Mobile share sheet integration (iOS & Android) + Chrome/Edge browser extension
- Smart metadata extraction (title, image, price) via OG tags, JSON-LD, and heuristics
- Collections with public link sharing and email invite collaboration (viewer/editor roles)
- Real-time sync and offline queue

Full spec: `SaveIt_Product_Spec.docx` in this directory.

## Tech Stack (Decided)

**Backend: Supabase** (existing account, to be connected)
- Auth: Supabase Auth with Google OAuth
- Database: PostgreSQL with Row Level Security
- Edge Functions: Deno (metadata enrichment, email invites)
- Realtime: Supabase Realtime subscriptions
- Storage: Supabase Storage (product thumbnails, avatars)

> Backend can be migrated later if scaling requires it. Supabase runs on AWS infrastructure and has an Enterprise tier — starting here is the right call.

**Mobile:** Flutter (`mobile_flutter/`) — iOS + Android, with a native iOS share extension (`ios/ShareExtension/ShareViewController.swift`)
**Web:** Next.js App Router (`web/`) — public collection pages, invite acceptance, in-browser app
**Browser:** Chrome/Edge extension (`extension/`, Manifest V3)

## Database Schema (5 core tables)

| Table | Purpose |
|-------|---------|
| `profiles` | Extends auth.users with display name, avatar |
| `collections` | User-created groupings (Gifts, Wishlist, etc.) |
| `items` | Saved product records with metadata |
| `collection_shares` | Email-based sharing with viewer/editor roles |
| `tags` | (Future) Cross-collection tagging |

All tables use Row Level Security (RLS). Full schema in spec doc.

## MVP Roadmap (12 weeks)

| Phase | Weeks | Focus |
|-------|-------|-------|
| 1 - Foundation | 1–3 | Supabase setup, schema, auth, core mobile screens |
| 2 - Share Extension | 4–6 | iOS/Android share integration, metadata enrichment |
| 3 - Browser Extension | 7–9 | Chrome extension, public links, email sharing |
| 4 - Polish & Launch | 10–12 | App Store, Play Store, Chrome Web Store |

## Developer Background
- Experienced with Claude Code and Supabase
- Prefers minimal manual wiring — leverage managed services over custom infrastructure
- Has an existing Supabase account to connect this project to
