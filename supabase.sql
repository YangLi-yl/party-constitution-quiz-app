create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_data jsonb not null default '{}'::jsonb,
  score numeric default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.question_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  status text,
  wrong_count int not null default 0,
  favorite boolean not null default false,
  last_answer text,
  last_result text,
  reason text,
  updated_at timestamptz not null default now(),
  unique(user_id, question_id)
);

create index if not exists idx_exam_records_user_created on public.exam_records(user_id, created_at desc);
create index if not exists idx_question_records_user_question on public.question_records(user_id, question_id);
create index if not exists idx_question_records_user_status on public.question_records(user_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_progress_set_updated_at on public.user_progress;
create trigger user_progress_set_updated_at
before update on public.user_progress
for each row execute function public.set_updated_at();

drop trigger if exists question_records_set_updated_at on public.question_records;
create trigger question_records_set_updated_at
before update on public.question_records
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.exam_records enable row level security;
alter table public.question_records enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists progress_select_own on public.user_progress;
drop policy if exists progress_insert_own on public.user_progress;
drop policy if exists progress_update_own on public.user_progress;
create policy progress_select_own on public.user_progress for select using (auth.uid() = user_id);
create policy progress_insert_own on public.user_progress for insert with check (auth.uid() = user_id);
create policy progress_update_own on public.user_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists exam_select_own on public.exam_records;
drop policy if exists exam_insert_own on public.exam_records;
create policy exam_select_own on public.exam_records for select using (auth.uid() = user_id);
create policy exam_insert_own on public.exam_records for insert with check (auth.uid() = user_id);

drop policy if exists question_select_own on public.question_records;
drop policy if exists question_insert_own on public.question_records;
drop policy if exists question_update_own on public.question_records;
create policy question_select_own on public.question_records for select using (auth.uid() = user_id);
create policy question_insert_own on public.question_records for insert with check (auth.uid() = user_id);
create policy question_update_own on public.question_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
