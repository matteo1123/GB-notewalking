create table public.evaluation_prompts (
  module_type text primary key,
  system_prompt text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.evaluation_prompts enable row level security;

-- Edge functions will use service_role, but allow authenticated users to view if needed
create policy "evaluation_prompts are viewable by authenticated users"
  on public.evaluation_prompts for select
  using ( auth.role() = 'authenticated' );

create table public.practice_evaluations (
  id uuid primary key default gen_random_uuid(),
  practice_log_id bigint not null references public.practice_log(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  midi_data jsonb,
  harmonic_context jsonb,
  ai_feedback text,
  created_at timestamp with time zone default now()
);

alter table public.practice_evaluations enable row level security;

create policy "Users can view their own practice evaluations"
  on public.practice_evaluations for select
  using ( auth.uid() = user_id );

-- Insertions will be done by the edge function, but if users need to insert:
create policy "Users can insert their own practice evaluations"
  on public.practice_evaluations for insert
  with check ( auth.uid() = user_id );
