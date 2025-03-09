# Habits - Social Accountability App

A simple web application that helps friends build good habits together through mutual accountability.

## Core Features

- Create challenges for daily habits and invite friends
- Email-based interaction (no dashboard needed)
- Daily check-ins at 9pm
- Streak tracking with visual elements
- Notifications when streaks are broken

## Project Structure

### Frontend
- `public/` - Static assets
- `views/` - HTML templates (EJS)

### Backend
- `app.js` - Main application entry point
- `controllers/` - Route handlers
- `services/` - Business logic and external services
- `email_templates/` - HTML templates for emails

## Tech Stack

- **Node.js & Express** - Backend server
- **Supabase** - Database and authentication
- **EJS** - Server-side templating
- **Nodemailer** - Email service

## Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Set up the following tables in your Supabase database:

### Table: users
```sql
create table users (
  id uuid default uuid_generate_v4() primary key,
  email varchar not null unique,
  name varchar,
  created_at timestamp with time zone default now() not null
);
```

### Table: challenges
```sql
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
```

### Table: streak_history
```sql
create table streak_history (
  id uuid default uuid_generate_v4() primary key,
  challenge_id uuid references challenges(id) not null,
  user_id uuid references users(id) not null,
  streak_count integer default 0,
  history text[] default '{}',
  unique(challenge_id, user_id)
);
```

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure your environment variables:
   - Set your Supabase URL and anon key
   - Configure email settings
4. Run the application: `npm start` or `npm run dev` for development mode

## Security Considerations

For a production deployment, consider implementing:

1. Email verification for users
2. Rate limiting to prevent abuse
3. CAPTCHA or similar verification on forms
4. Clear privacy policy and unsubscribe options in emails
