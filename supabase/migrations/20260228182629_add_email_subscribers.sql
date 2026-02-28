create table public.email_subscribers (
    id uuid default gen_random_uuid() primary key,
    email text not null unique,
    source text not null,
    requested_resource text,
    fulfilled boolean default false not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security
alter table public.email_subscribers enable row level security;

-- Allow anonymous inserts so public users can join the list
create policy "Allow public inserts"
    on public.email_subscribers
    for insert
    to public
    with check (true);

-- Only service role / authenticated admins can view list
create policy "Allow admins to view subscribers"
    on public.email_subscribers
    for select
    to authenticated
    using (true); 
