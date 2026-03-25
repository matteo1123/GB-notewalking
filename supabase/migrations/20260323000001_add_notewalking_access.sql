alter table public.profiles
  add column if not exists has_notewalking_access boolean not null default false;
