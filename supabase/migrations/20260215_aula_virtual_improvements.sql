-- Add duration to videos
alter table virtual_classroom_videos add column if not exists duration text;

-- Create favorites table
create table if not exists virtual_classroom_favorites (
    user_id uuid references auth.users(id) on delete cascade not null,
    video_id uuid references virtual_classroom_videos(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, video_id)
);

-- Create progress table
create table if not exists virtual_classroom_progress (
    user_id uuid references auth.users(id) on delete cascade not null,
    video_id uuid references virtual_classroom_videos(id) on delete cascade not null,
    is_completed boolean default false,
    progress_seconds integer default 0,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, video_id)
);

-- Enable RLS
alter table virtual_classroom_favorites enable row level security;
alter table virtual_classroom_progress enable row level security;

-- Policies for favorites
create policy "Users can view their own favorites" on virtual_classroom_favorites
    for select using (auth.uid() = user_id);

create policy "Users can insert their own favorites" on virtual_classroom_favorites
    for insert with check (auth.uid() = user_id);

create policy "Users can delete their own favorites" on virtual_classroom_favorites
    for delete using (auth.uid() = user_id);

-- Policies for progress
create policy "Users can view their own progress" on virtual_classroom_progress
    for select using (auth.uid() = user_id);

create policy "Users can insert their own progress" on virtual_classroom_progress
    for insert with check (auth.uid() = user_id);

create policy "Users can update their own progress" on virtual_classroom_progress
    for update using (auth.uid() = user_id);
