create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  website text,
  youtube text,
  band text,

  primary key (id)
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( (select auth.uid()) = id );

create policy "Users can update their own profile."
  on public.profiles for update
  using ( (select auth.uid()) = id );

-- inserts a row into public.profiles
create function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

-- trigger the function every time a user is created
create trigger on_auth_user_created_add_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();