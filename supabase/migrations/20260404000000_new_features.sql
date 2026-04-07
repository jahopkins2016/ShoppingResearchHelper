-- ============================================================
-- FEEDBACK
-- ============================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('bug', 'feature', 'general', 'complaint')),
  message text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved')),
  created_at timestamptz default now()
);

alter table public.feedback enable row level security;

create policy "Users can insert their own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_messages_conversation
  on public.messages (conversation_id, created_at desc);

create index if not exists idx_conversation_participants_user
  on public.conversation_participants (user_id);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Conversations: users can see conversations they participate in
create policy "Participants can view their conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = conversations.id
        and user_id = auth.uid()
    )
  );

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (true);

create policy "Participants can update their conversations"
  on public.conversations for update
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = conversations.id
        and user_id = auth.uid()
    )
  );

-- Conversation participants
create policy "Participants can view conversation members"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "Authenticated users can add participants"
  on public.conversation_participants for insert
  with check (true);

-- Messages
create policy "Participants can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id
        and user_id = auth.uid()
    )
  );

create policy "Participants can send messages"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id
        and user_id = auth.uid()
    )
    and sender_id = auth.uid()
  );

create policy "Senders can update their own messages"
  on public.messages for update
  using (sender_id = auth.uid());

-- ============================================================
-- FRIENDS (derived from sharing history)
-- ============================================================
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'share' check (source in ('share', 'manual')),
  created_at timestamptz default now(),
  unique (user_id, friend_id)
);

create index if not exists idx_friends_user
  on public.friends (user_id);

alter table public.friends enable row level security;

create policy "Users can view their own friends"
  on public.friends for select
  using (auth.uid() = user_id);

create policy "Users can manage their own friends"
  on public.friends for all
  using (auth.uid() = user_id);

-- Allow users to see friend profiles
create policy "Users can view friend profiles"
  on public.profiles for select using (
    exists (
      select 1 from public.friends
      where friends.user_id = auth.uid()
        and friends.friend_id = profiles.id
    )
  );

-- ============================================================
-- ITEM COMPARISONS
-- ============================================================
create table if not exists public.item_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Untitled Comparison',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.comparison_items (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null references public.item_comparisons(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  sort_order integer default 0,
  unique (comparison_id, item_id)
);

create index if not exists idx_comparison_items_comparison
  on public.comparison_items (comparison_id, sort_order);

alter table public.item_comparisons enable row level security;
alter table public.comparison_items enable row level security;

create policy "Users can manage their own comparisons"
  on public.item_comparisons for all
  using (auth.uid() = user_id);

create policy "Users can manage comparison items they own"
  on public.comparison_items for all
  using (
    exists (
      select 1 from public.item_comparisons
      where item_comparisons.id = comparison_items.comparison_id
        and item_comparisons.user_id = auth.uid()
    )
  );
