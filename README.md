# Habits - Build Good Habits Together

A simple web application to challenge friends to build habits together and track your streaks.

## Overview

This app allows users to:
- Challenge a friend to build a daily habit
- Receive daily check-in emails
- Track streak progress for both participants
- Get notifications when streaks are broken

## Setup and Installation

1. Clone the repository:
```
git clone https://github.com/cpenniman12/habits.git
cd habits
```

2. Install dependencies:
```
npm install
```

3. Create a `.env` file based on `.env.example`:
```
cp .env.example .env
```

4. Set up your environment variables in the `.env` file:
- Configure your Supabase credentials
- Set up SendGrid API key for emails
- Configure app URLs for both local development and production

5. Start the application:
```
npm start
```

## Environment Variables

Make sure to properly configure these environment variables in your `.env` file:

```
# Application
PORT=3000
APP_URL=http://localhost:3000
PUBLIC_APP_URL=https://your-public-domain.com

# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# SendGrid Email Configuration
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=YourApp <youremail@domain.com>
```

**Important**: 
- `APP_URL` should be your local development URL (usually http://localhost:3000)
- `PUBLIC_APP_URL` should be your live/production URL that is publicly accessible from the internet
  
The app will use `PUBLIC_APP_URL` for links in emails. This ensures that when users click links in the emails they receive, they go to a publicly accessible URL instead of trying to access your local machine.

## Database Setup

The application uses Supabase as the database. You can find the database schema in `supabase/schema.sql`.

## Email Templates

Email templates are stored in the `email_templates` directory. The app sends different types of emails:
- Invitation emails when a challenge is created
- Acceptance notifications when a challenge is accepted
- Daily check-in reminders
- Streak broken notifications

## License

MIT