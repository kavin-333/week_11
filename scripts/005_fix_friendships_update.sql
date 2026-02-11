-- Allow either party to update a friendship (for re-sending rejected requests)
drop policy if exists "friendships_update_addressee" on public.friendships;
create policy "friendships_update_own" on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
