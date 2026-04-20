# Feature Spec: [Feature Name]

_Status: Draft | In Review | Approved | Building | Shipped_
_Author: Jason Hopkins | Date: YYYY-MM-DD_

---

## Problem

**What pain does this solve?**
Describe the specific friction or gap, not the solution. What does a user have to do today that this removes?

**Who feels it?**
Which user type(s)? How often? How severe?

**Evidence:**
What signals point to this being real — user feedback, support requests, observed behavior, data, your own experience using the app?

---

## Users

**Primary:** Who benefits most directly? What do they already know/have when they hit this feature?

**Secondary:** Who else is affected (e.g., collection recipients, collaborators)?

**Persona note:** If the behavior differs significantly between user types (new vs. returning, mobile vs. web), call that out here.

---

## Success Metrics

**Leading indicators** (measurable during rollout):
- [ ] e.g., feature adoption rate within 7 days of release
- [ ] e.g., step completion rate in the new flow

**Lagging indicators** (measurable weeks/months later):
- [ ] e.g., retention impact, collection size growth, share rate

**Definition of done:**
What does "this shipped successfully" look like in plain terms? What would make you confident it's working?

**Anti-goals / what we're not measuring:**
Anything you're explicitly not optimizing for.

---

## UX Flow

### Happy path

1. User is at [starting screen/state]
2. They [action]
3. System responds with [feedback/result]
4. ...
5. End state: [what the user now has/sees]

### Edge cases & error states

| Scenario | Expected behavior |
|----------|-------------------|
| Network offline when submitting | ... |
| Empty state (no data yet) | ... |
| User lacks permission (viewer role) | ... |
| Input validation failure | ... |

### Screens / components affected

List which existing screens change and which new ones are needed. Note platform: mobile, web, extension.

---

## Data Model Changes

**New tables:**

```sql
-- table name
create table example (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);
```

**New columns on existing tables:**

| Table | Column | Type | Nullable | Notes |
|-------|--------|------|----------|-------|
| items | ... | text | yes | ... |

**New RLS policies:**

Describe who can read/write each new table/column. Flag if this expands access to data that existing users could see unexpectedly.

**New DB triggers or functions:**

Describe any triggers, RPCs, or scheduled logic needed.

**Migration file name (suggested):** `YYYYMMDDHHMMSS_feature_name.sql`

---

## API Surface

**New Edge Functions:**

| Function | Trigger | Input | Output | Auth |
|----------|---------|-------|--------|------|
| `function-name` | HTTP POST | `{ field: type }` | `{ result: type }` | User JWT |

**New Supabase RPCs:**

```sql
create or replace function example_rpc(param text)
returns json language plpgsql security definer as $$
begin
  -- ...
end;
$$;
```

**Changes to existing endpoints/functions:**
List any modifications to existing Edge Functions, including new env vars required.

**New env vars required:**

| Variable | Where needed | Notes |
|----------|-------------|-------|
| `EXAMPLE_API_KEY` | enrich-item function | Get from ... |

---

## Rollout Plan

**Dependencies before this can ship:**
- [ ] e.g., migration X must run first
- [ ] e.g., requires Supabase env var Y to be set
- [ ] e.g., blocked by feature Z being completed first

**Rollout sequence:**
1. Deploy migration
2. Deploy Edge Function(s)
3. Release web
4. Release mobile (note: mobile releases lag due to App Store review)
5. Release extension (note: Chrome Web Store review ~1–3 days)

**Reversibility:**
Can this be rolled back cleanly? What's the rollback plan if something goes wrong post-deploy?

**Platform notes:**
- Mobile: any new permissions needed (camera, location, notifications)?
- Extension: any new manifest permissions that require re-review?
- RLS: test with a viewer-role user to confirm they can't write

---

## Open Questions

Questions that need answers before or during the build. Assign an owner and a due date if known.

| Question | Why it matters | Owner | Status |
|----------|---------------|-------|--------|
| Should this be gated to editors only, or also viewers? | Affects RLS design | — | open |
| What happens to existing data when we add this column? | Migration safety | — | open |
| Do we need a loading/skeleton state for slow network? | UX | — | open |
