-- Run this in Supabase Dashboard → SQL Editor

-- Jobs table
create table if not exists jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  youtube_url text not null,
  video_title text,
  status text default 'pending',
  created_at timestamp default now()
);

-- Clips table
create table if not exists clips (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id),
  clip_number int,
  start_time int,
  end_time int,
  caption text,
  hashtags text,
  platforms text[],
  post_status text default 'pending',
  zernio_post_id text,
  created_at timestamp default now()
);

-- Enable RLS
alter table jobs enable row level security;
alter table clips enable row level security;

-- Jobs policies
create policy "Users can insert own jobs"
  on jobs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view own jobs"
  on jobs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own jobs"
  on jobs for update
  to authenticated
  using (auth.uid() = user_id);

-- Clips policies
create policy "Users can insert clips for own jobs"
  on clips for insert
  to authenticated
  with check (
    exists (
      select 1 from jobs
      where jobs.id = clips.job_id
      and jobs.user_id = auth.uid()
    )
  );

create policy "Users can view own clips"
  on clips for select
  to authenticated
  using (
    exists (
      select 1 from jobs
      where jobs.id = clips.job_id
      and jobs.user_id = auth.uid()
    )
  );
