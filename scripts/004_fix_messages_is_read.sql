-- Replace read_at with is_read boolean
alter table public.messages drop column if exists read_at;
alter table public.messages add column if not exists is_read boolean default false;
