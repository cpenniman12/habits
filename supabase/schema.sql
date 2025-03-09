-- Schema for Habits application
-- To be run in Supabase SQL Editor

-- Users table
create table users (
  id uuid default uuid_generate_v4() primary key,
  email varchar not null unique,
  name varchar,
  created_at timestamp with time zone default now() not null
);

-- Create index on email for faster lookups
create index users_email_idx on users (email);

-- Challenges table
create table challenges (
  id uuid default uuid_generate_v4() primary key,
  habit_description text not null,
  initiator_id uuid references users(id) not null,
  friend_id uuid references users(id) not null,
  status varchar not null default 'pending',
  invite_token uuid not null unique,
  start_date timestamp with time zone,
  initiator_streak integer default 0,
  friend_streak integer default 0,
  created_at timestamp with time zone default now() not null
);

-- Create indexes
create index challenges_initiator_idx on challenges (initiator_id);
create index challenges_friend_idx on challenges (friend_id);
create index challenges_token_idx on challenges (invite_token);
create index challenges_status_idx on challenges (status);

-- Streak history table
create table streak_history (
  id uuid default uuid_generate_v4() primary key,
  challenge_id uuid references challenges(id) not null,
  user_id uuid references users(id) not null,
  streak_count integer default 0,
  history text[] default '{}',
  unique(challenge_id, user_id)
);

-- Create indexes
create index streak_history_challenge_idx on streak_history (challenge_id);
create index streak_history_user_idx on streak_history (user_id);

-- Create RLS policies (Row Level Security)
-- This is a good practice for security even if we're not using it in the MVP

-- Enable RLS on all tables
alter table users enable row level security;
alter table challenges enable row level security;
alter table streak_history enable row level security;

-- For now, allow all operations (for simplicity in MVP)
-- In a production app, you would restrict these policies
create policy "Allow all operations on users" on users for all using (true);
create policy "Allow all operations on challenges" on challenges for all using (true);
create policy "Allow all operations on streak_history" on streak_history for all using (true);