-- Profiles table (auto-created on signup via trigger)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Everyone can see profiles (needed for friend search)
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- Friendships table
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;

-- Users can see friendships they are part of
create policy "friendships_select_own" on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Users can send friend requests
create policy "friendships_insert_own" on public.friendships for insert
  with check (auth.uid() = requester_id);

-- Only the addressee can update (accept/reject) a friendship
create policy "friendships_update_addressee" on public.friendships for update
  using (auth.uid() = addressee_id);

-- Either party can delete a friendship
create policy "friendships_delete_own" on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null references public.friendships(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

alter table public.messages enable row level security;

-- Users can see messages from their friendships
create policy "messages_select_own" on public.messages for select
  using (
    exists (
      select 1 from public.friendships f
      where f.id = friendship_id
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
      and f.status = 'accepted'
    )
  );

-- Users can send messages to accepted friendships
create policy "messages_insert_own" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.friendships f
      where f.id = friendship_id
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
      and f.status = 'accepted'
    )
  );

-- Users can update their own messages (for read receipts)
create policy "messages_update_own" on public.messages for update
  using (
    exists (
      select 1 from public.friendships f
      where f.id = friendship_id
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
      and f.status = 'accepted'
    )
  );
