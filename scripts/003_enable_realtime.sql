-- Enable realtime for messages and friendships
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.friendships;
