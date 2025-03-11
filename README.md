# Eighteen - The Habit Launchpad

A modern web application to build habits with accountability partners and track your 18-day habit formation journey.

## Overview

This app allows users to:
- Challenge a friend to build a daily habit for 18 days
- Receive daily check-in emails at 5am ET
- Track streak progress for both participants
- Visualize habit progress with intuitive dashboards
- Get notifications when streaks are broken

## Why 18 Days?

Research shows 18 days is the minimum time needed to form a simple habit. The first 18 days are when your brain creates the strongest neural pathways. Once past this critical period, the habit becomes nearly automatic.

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
EMAIL_FROM=Eighteen <youremail@domain.com>
```

**IMPORTANT**: 
- `APP_URL` should be your local development URL (usually http://localhost:3000)
- `PUBLIC_APP_URL` should be your live/production URL that is publicly accessible from the internet
  
The app will use `PUBLIC_APP_URL` for links in emails. This ensures that when users click links in the emails they receive, they go to a publicly accessible URL instead of trying to access your local machine.

## Email Check-in System

- Daily check-ins are sent at 5am ET each day (9am UTC)
- Users have until midnight to complete their habit and mark it as done
- Streak count increments with each successful check-in
- Streak resets if a user misses a day or clicks "Not today"

### Cron Job for Daily Emails

The application uses a cron job to automatically send emails at 5am ET every day. For the cron job to work:

1. Your server must be running continuously (e.g., using PM2, Docker, or a hosting service)
2. If your server timezone is not UTC, you may need to adjust the cron schedule time
3. The server needs proper network access to send emails via SendGrid

### Manual Trigger for Check-in Emails

If the automatic cron job isn't working or you need to send check-ins at a different time, you can use the manual trigger endpoint:

```
GET /admin/trigger-checkins
```

This endpoint will immediately send check-in emails to all active challenges. You can access it by visiting:
`https://your-app-domain.com/admin/trigger-checkins`

## Troubleshooting Check-in Emails

If check-in emails aren't being sent:

1. **Server Uptime**: Check if your server is running continuously. The cron job only works when the server is active.
2. **Timezone Settings**: Verify that the cron schedule aligns with your server's timezone.
3. **SendGrid Configuration**: Ensure your SendGrid API key is valid and has proper permissions.
4. **Environment Variables**: Check that EMAIL_FROM is properly configured in your .env file.
5. **Network Access**: Make sure your server can connect to SendGrid's API.
6. **Application Logs**: Review server logs for any errors during the scheduled check-in time.
7. **Manual Trigger**: Try the manual trigger endpoint to see if emails can be sent on demand.

## Database Setup

The application uses Supabase as the database. You can find the database schema in `supabase/schema.sql`.

## Email Templates

Email templates are stored in the `email_templates` directory. The app sends different types of emails:
- Invitation emails when a challenge is created
- Acceptance notifications when a challenge is accepted
- Daily check-in reminders
- Streak broken notifications

## Dashboard Visualization

The app includes a visual dashboard showing:
- Active challenges with user pairings
- Current streak progress for each participant
- Visual representation of completed days toward the 18-day goal
- Color-coded habit categories

## License

MIT